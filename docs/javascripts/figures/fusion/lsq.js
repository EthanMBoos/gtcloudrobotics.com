// Small dense estimation helpers shared by the background-page figures:
// a linear solver, linear least squares in the plane, Gauss-Newton with a
// numeric Jacobian, and a constant-velocity Kalman filter.

// Solve A x = b by Gaussian elimination. A is n*n row-major; both are overwritten.
export function solve(A, b) {
  const n = b.length
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r
    if (p !== c) {
      for (let k = c; k < n; k++) [A[c * n + k], A[p * n + k]] = [A[p * n + k], A[c * n + k]]
      ;[b[c], b[p]] = [b[p], b[c]]
    }
    const d = A[c * n + c] || 1e-12
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / d
      if (!f) continue
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k]
      b[r] -= f * b[c]
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * b[k]
    b[r] = s / (A[r * n + r] || 1e-12)
  }
  return b
}

// Linear least squares over n planar points whose x and y decouple. Each
// factor says sum(coef[a] * p[idx[a]]) = z with weight w = 1 / sigma^2.
export class Normal {
  constructor(n) {
    this.n = n
    this.H = new Float64Array(n * n)
    this.gx = new Float64Array(n)
    this.gy = new Float64Array(n)
  }

  add(idx, coef, zx, zy, w) {
    for (let a = 0; a < idx.length; a++) {
      this.gx[idx[a]] += w * coef[a] * zx
      this.gy[idx[a]] += w * coef[a] * zy
      for (let b = 0; b < idx.length; b++) this.H[idx[a] * this.n + idx[b]] += w * coef[a] * coef[b]
    }
  }

  solve() {
    return [solve(this.H.slice(), this.gx.slice()), solve(this.H.slice(), this.gy.slice())]
  }
}

// Levenberg-Marquardt on resid(x) -> array, numeric Jacobian. Mutates and returns x.
export function gaussNewton(x, resid, iters = 10) {
  const n = x.length
  const sq = (r) => r.reduce((a, v) => a + v * v, 0)
  let r = resid(x)
  let cost = sq(r)
  let lam = 1e-4
  for (let it = 0; it < iters; it++) {
    const m = r.length
    const J = new Float64Array(m * n)
    for (let j = 0; j < n; j++) {
      const old = x[j]
      x[j] = old + 1e-6
      const r2 = resid(x)
      x[j] = old
      for (let i = 0; i < m; i++) J[i * n + j] = (r2[i] - r[i]) / 1e-6
    }
    const H = new Float64Array(n * n)
    const g = new Float64Array(n)
    for (let i = 0; i < m; i++) {
      const nz = []
      for (let j = 0; j < n; j++) if (J[i * n + j]) nz.push(j)
      for (const a of nz) {
        g[a] -= J[i * n + a] * r[i]
        for (const b of nz) H[a * n + b] += J[i * n + a] * J[i * n + b]
      }
    }
    let ok = false
    for (let k = 0; k < 6 && !ok; k++) {
      const A = H.slice()
      for (let j = 0; j < n; j++) A[j * n + j] += lam * (H[j * n + j] + 1e-9)
      const dx = solve(A, g.slice())
      const xn = x.map((v, j) => v + dx[j])
      const rn = resid(xn)
      const cn = sq(rn)
      if (cn < cost) {
        for (let j = 0; j < n; j++) x[j] = xn[j]
        ok = cost - cn > 1e-10 * cost
        r = rn
        cost = cn
        lam /= 3
        if (!ok) return x
      } else lam *= 5
    }
    if (!ok) break
  }
  return x
}

// Constant-velocity Kalman filter in the plane. x and y share one 2x2
// covariance [pp, pv, vv] because their noise is the same.
export class CV {
  constructor(x, y, vx = 0, vy = 0, pp = 0.05, vv = 0.5) {
    this.x = [x, vx, y, vy]
    this.P = [pp, 0, vv]
  }

  predict(dt, q) {
    const s = this.x
    s[0] += s[1] * dt
    s[2] += s[3] * dt
    const [a, b, c] = this.P
    const q2 = q * q
    this.P = [a + 2 * dt * b + dt * dt * c + (q2 * dt ** 4) / 4, b + dt * c + (q2 * dt ** 3) / 2, c + q2 * dt * dt]
  }

  // Squared distance of a measurement in units of the innovation variance.
  d2(zx, zy, R) {
    return ((zx - this.x[0]) ** 2 + (zy - this.x[2]) ** 2) / (this.P[0] + R)
  }

  update(zx, zy, R) {
    const [a, b, c] = this.P
    const S = a + R
    const k0 = a / S
    const k1 = b / S
    const ix = zx - this.x[0]
    const iy = zy - this.x[2]
    this.x[0] += k0 * ix
    this.x[1] += k1 * ix
    this.x[2] += k0 * iy
    this.x[3] += k1 * iy
    this.P = [a - k0 * a, b - k0 * b, c - k1 * b]
  }
}
