// Toy vehicle models and controllers for the control figures. No rendering
// here, so everything in this file also runs under node.
//
// Accelerations are in m/s^2 for the mass the controller assumes. The
// controller runs at 100 Hz and the physics at 500 Hz.

export const G = 9.81
export const H = 0.01
const SUB = 5

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// A command passes through a transport delay and then a first-order motor lag.
class Motor {
  constructor(value) {
    this.q = []
    this.f = value
  }

  step(cmd, delay) {
    const n = Math.round(delay / H)
    this.q.push(cmd)
    while (this.q.length > n + 1) this.q.shift()
    this.target = this.q[0]
    return this
  }

  sub(tau, dt) {
    this.f = tau > 0 ? this.f + (this.target - this.f) * Math.min(dt / tau, 1) : this.target
    return this.f
  }
}

// One-dimensional altitude under a PID law with hover feedforward.
export class Alt {
  constructor(o = {}) {
    this.o = {
      kp: 4,
      ki: 0,
      kd: 4,
      feedback: true,
      extra: 0, // mass the controller does not know about, as a fraction
      tw: 2, // thrust-to-weight ratio
      tau: 0.05,
      delay: 0.03,
      noise: 0, // position noise, m
      tf: 0, // derivative filter time constant, s
      antiWindup: true,
      rand: () => 0,
      ...o,
    }
    this.reset(0)
  }

  reset(z, ref = z) {
    this.z = z
    this.v = 0
    this.ref = ref
    this.i = 0
    this.d = 0
    this.prev = z
    this.u = this.us = G
    this.motor = new Motor(G * (1 + this.o.extra))
    this.t = 0
  }

  step() {
    const o = this.o
    const meas = this.z + o.noise * o.rand()
    const e = this.ref - meas
    const raw = -(meas - this.prev) / H
    this.prev = meas
    this.d += (raw - this.d) * (H / (o.tf + H))
    const max = o.tw * G
    let u = G
    if (o.feedback) u += o.kp * e + o.ki * this.i + o.kd * this.d
    const us = clamp(u, 0, max)
    // Clamping: stop integrating while the error pushes further into the limit.
    const pushing = (u > max && e > 0) || (u < 0 && e < 0)
    if (!(o.antiWindup && pushing)) this.i += e * H
    this.u = u
    this.us = us
    this.e = this.ref - this.z
    this.motor.step(us, o.delay)
    for (let k = 0; k < SUB; k++) {
      const f = this.motor.sub(o.tau, H / SUB)
      this.v += (f / (1 + o.extra) - G) * (H / SUB)
      this.z += this.v * (H / SUB)
      if (this.z < 0) {
        this.z = 0
        this.v = Math.max(this.v, 0)
      }
    }
    this.t += H
  }
}

// Planar quadrotor: a position loop asks for a tilt, an attitude loop
// delivers it. The attitude loop is a first-order response at rate `inner`.
export class Planar {
  constructor(o = {}) {
    this.o = { outer: 2, ratio: 4, tiltMax: 45, compensate: true, ...o }
    this.reset(0, 2)
  }

  reset(x, z) {
    Object.assign(this, { x, z, vx: 0, vz: 0, th: 0, thCmd: 0, xr: x, zr: z, T: G, t: 0 })
  }

  step() {
    const o = this.o
    const w = o.outer
    const ax = w * w * (this.xr - this.x) - 1.4 * w * this.vx
    const lim = (o.tiltMax * Math.PI) / 180
    this.thCmd = clamp(Math.atan2(ax, G), -lim, lim)
    const az = 9 * (this.zr - this.z) - 4.2 * this.vz
    this.T = clamp((G + az) / (o.compensate ? Math.cos(this.th) : 1), 0, 2 * G)
    for (let k = 0; k < SUB; k++) {
      const dt = H / SUB
      this.th += o.ratio * w * (this.thCmd - this.th) * dt
      this.vx += this.T * Math.sin(this.th) * dt
      this.vz += (this.T * Math.cos(this.th) - G) * dt
      this.x += this.vx * dt
      this.z = Math.max(this.z + this.vz * dt, 0)
    }
    this.t += H
  }
}

// One horizontal axis as a double integrator: the input is an acceleration
// (i.e., a tilt), limited to +-umax. `d` is a force the controller does not
// know about. Lag and delay are zero unless set.
export class Axis {
  constructor(o = {}) {
    this.o = { umax: 5, tau: 0, delay: 0, ...o }
    this.reset(0)
  }

  reset(p) {
    this.p = p
    this.v = 0
    this.d = 0
    this.motor = new Motor(0)
    this.t = 0
  }

  // Hold input u for `dt` seconds (a multiple of the physics step).
  step(u, dt = H) {
    const o = this.o
    this.us = clamp(u, -o.umax, o.umax)
    const n = Math.round(dt / (H / SUB))
    this.motor.step(this.us, o.delay)
    for (let k = 0; k < n; k++) {
      const a = this.motor.sub(o.tau, H / SUB) + this.d
      this.v += a * (H / SUB)
      this.p += this.v * (H / SUB)
    }
    this.t += dt
  }
}

// Discrete LQR for the double integrator with step h, cost
// sum(q1 p^2 + q2 v^2 + r u^2). Returns the gain [kp, kd] and the cost-to-go
// matrix P = [p11, p12, p22].
export function lqr(q1, q2, r, h) {
  const b1 = (h * h) / 2
  const b2 = h
  let [p11, p12, p22] = [q1, 0, q2]
  let k1 = 0
  let k2 = 0
  for (let i = 0; i < 4000; i++) {
    // P A, with A = [[1, h], [0, 1]]
    const a11 = p11
    const a12 = p11 * h + p12
    const a21 = p12
    const a22 = p12 * h + p22
    const pb1 = p11 * b1 + p12 * b2
    const pb2 = p12 * b1 + p22 * b2
    const s = r + b1 * pb1 + b2 * pb2
    k1 = (b1 * a11 + b2 * a21) / s
    k2 = (b1 * a12 + b2 * a22) / s
    // A' P A - (A' P B) K + Q
    const n11 = a11 + q1 - pb1 * k1
    const n12 = a12 - pb1 * k2
    const n22 = h * a12 + a22 + q2 - (h * pb1 + pb2) * k2
    const done = Math.abs(n11 - p11) + Math.abs(n22 - p22) < 1e-10 * (1 + n11)
    p11 = n11
    p12 = n12
    p22 = n22
    if (done) break
  }
  return { K: [k1, k2], P: [p11, p12, p22] }
}

// Linear MPC for the same model with a box on the input: a condensed QP in
// the input sequence U, solved by projected gradient from a warm start.
export class Mpc {
  constructor({ N = 40, h = 0.05, q1 = 10, q2 = 1, r = 0.1 } = {}) {
    Object.assign(this, { N, h, q1, q2, r })
    const { K, P } = lqr(q1, q2, r, h)
    this.K = K
    this.P = P
    // Position and velocity at step k (1..N) per unit of input j.
    const Sp = (k, j) => (j < k ? h * h * (k - j - 0.5) : 0)
    const Sv = (k, j) => (j < k ? h : 0)
    const Hm = new Float64Array(N * N)
    for (let a = 0; a < N; a++) {
      for (let b = a; b < N; b++) {
        let s = a === b ? r : 0
        for (let k = b + 1; k <= N; k++) {
          const [w11, w12, w22] = k === N ? P : [q1, 0, q2]
          const pa = Sp(k, a)
          const pb = Sp(k, b)
          s += w11 * pa * pb + w12 * (pa * h + h * pb) + w22 * h * h
        }
        Hm[a * N + b] = Hm[b * N + a] = s
      }
    }
    this.Hm = Hm
    this.Sp = Sp
    this.Sv = Sv
    // Largest eigenvalue by power iteration, for the step size.
    let v = new Float64Array(N).fill(1)
    let L = 1
    for (let i = 0; i < 60; i++) {
      const w = this.mul(v)
      L = Math.hypot(...w)
      v = w.map((x) => x / L)
    }
    this.L = L * 1.01
    this.U = new Float64Array(N)
    this.g = new Float64Array(N)
  }

  mul(v) {
    const { N, Hm } = this
    const out = new Float64Array(N)
    for (let a = 0; a < N; a++) {
      let s = 0
      for (let b = 0; b < N; b++) s += Hm[a * N + b] * v[b]
      out[a] = s
    }
    return out
  }

  // x = [position error, velocity]. Returns the first input of the plan.
  solve(p, v, lo, hi, iters = 20) {
    const { N, h, q1, q2, P, U, g, Hm } = this
    g.fill(0)
    for (let k = 1; k <= N; k++) {
      const fp = p + k * h * v
      const [w11, w12, w22] = k === N ? P : [q1, 0, q2]
      const cp = w11 * fp + w12 * v
      const cv = w12 * fp + w22 * v
      for (let j = 0; j < k; j++) g[j] += this.Sp(k, j) * cp + h * cv
    }
    for (let it = 0; it < iters; it++) {
      let moved = 0
      for (let a = 0; a < N; a++) {
        let s = g[a]
        for (let b = 0; b < N; b++) s += Hm[a * N + b] * U[b]
        this.tmp[a] = s
      }
      for (let a = 0; a < N; a++) {
        const n = clamp(U[a] - this.tmp[a] / this.L, lo, hi)
        moved += Math.abs(n - U[a])
        U[a] = n
      }
      if (moved < 1e-7 * N) break
    }
    return U[0]
  }

  // Shift the plan one step, to start the next solve from it.
  shift() {
    this.U.copyWithin(0, 1)
  }

  // Positions the plan predicts, relative to the target.
  plan(p, v) {
    const out = [p]
    for (let k = 0; k < this.N; k++) {
      p += this.h * v + (this.h * this.h * this.U[k]) / 2
      v += this.h * this.U[k]
      out.push(p)
    }
    return out
  }

  get tmp() {
    return this._tmp || (this._tmp = new Float64Array(this.N))
  }
}

// A batch of 20 m moves for the training figure. With `random`, each flight
// has its own tailwind gust, motor lag, and delay; without, there is one
// flight with none of them.
export function flights(gust, random, n = 8) {
  if (!random) return [{ d: 0, t0: 0, tau: 0, delay: 0 }]
  let a = 7
  const r = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: n }, () => ({ d: gust * (0.3 + 0.7 * r()), t0: 1 + 2.5 * r(), tau: 0.05 + 0.1 * r(), delay: 0.02 + 0.06 * r() }))
}

export const WALL = 1.5 // meters past the target

// Fly every flight in the batch with an MPC whose weights are 10^l1 on
// position and 10^l2 on velocity, relative to effort. Returns the mean score
// (lower is better) and the number of flights that passed the wall.
export function flightScore(l1, l2, batch) {
  const h = 0.05
  const D = 20
  const m = new Mpc({ N: 30, h, q1: 0.1 * 10 ** l1, q2: 0.1 * 10 ** l2, r: 0.1 })
  let score = 0
  let crashes = 0
  for (const f of batch) {
    const ax = new Axis({ umax: 5, tau: f.tau, delay: f.delay })
    ax.reset(-D)
    m.U.fill(0)
    let c = 0
    let peak = -D
    for (let i = 0; i < 160; i++) {
      ax.d = ax.t >= f.t0 && ax.t < f.t0 + 1.5 ? f.d : 0
      const u = m.solve(ax.p, ax.v, -5, 5, 8)
      m.shift()
      ax.step(u, h)
      c += Math.abs(ax.p) * h
      peak = Math.max(peak, ax.p)
    }
    if (peak > WALL) crashes++
    score += c / D + (4 * Math.max(0, peak) ** 2) / D
  }
  return { score: score / batch.length, crashes }
}
