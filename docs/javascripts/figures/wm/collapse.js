// Representation collapse. Twelve positions of a drone on a loop are encoded
// by a linear map W into a two-dimensional embedding, and a linear predictor P
// maps each embedding to the next one. The loss is the squared error between
// the predicted and the actual next embedding. Each next position also has a
// small random part that cannot be predicted; its contribution to the loss is
// computed in expectation, and it is smaller for a smaller W. Gradient descent
// therefore shrinks every embedding toward one point unless a regularizer
// holds their covariance near the identity.

import { C, rng, drone, shadow, ball, Ribbon, Segs } from '../lib.js'

export const K = 12
const NOISE2 = 0.06 // variance of the unpredictable part of each next position
const LR = 0.04
const ang = (i) => (i / K) * 2 * Math.PI
export const states = Array.from({ length: K }, (_, i) => [Math.cos(ang(i)), Math.sin(ang(i))])
const mul = (M, x) => [M[0] * x[0] + M[1] * x[1], M[2] * x[0] + M[3] * x[1]]

export class Jepa {
  constructor(seed = 1) {
    const r = rng(seed)
    this.r = r
    this.th = Float64Array.from({ length: 8 }, (_, j) => (j < 4 ? 0.9 : 0.2) * r.n()) // W then P
  }

  embed(i) {
    return mul(this.th.subarray(0, 4), states[((i % K) + K) % K])
  }

  predict(i) {
    return mul(this.th.subarray(4, 8), this.embed(i))
  }

  // Prediction loss, including the expected cost of the unpredictable part.
  pred(th = this.th) {
    const W = th.subarray(0, 4)
    const P = th.subarray(4, 8)
    let s = 0
    for (let i = 0; i < K; i++) {
      const a = mul(P, mul(W, states[i]))
      const b = mul(W, states[(i + 1) % K])
      s += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
    }
    return s / K + NOISE2 * (W[0] ** 2 + W[1] ** 2 + W[2] ** 2 + W[3] ** 2)
  }

  // Squared distance of the embedding covariance from the identity. The
  // positions have covariance I/2, so the embeddings have W W^T / 2.
  reg(th = this.th) {
    const [a, b, c, d] = th
    const xx = (a * a + b * b) / 2 - 1
    const yy = (c * c + d * d) / 2 - 1
    const xy = (a * c + b * d) / 2
    return xx * xx + yy * yy + 2 * xy * xy
  }

  step(lam) {
    const f = (t) => this.pred(t) + lam * this.reg(t)
    const g = new Float64Array(8)
    for (let j = 0; j < 8; j++) {
      const t = this.th.slice()
      t[j] += 1e-5
      const up = f(t)
      t[j] -= 2e-5
      g[j] = (up - f(t)) / 2e-5
    }
    // The small random term stands for the noise of stochastic gradient descent.
    for (let j = 0; j < 8; j++) this.th[j] -= LR * Math.max(-5, Math.min(5, g[j])) + (j < 4 ? 1e-4 * this.r.n() : 0)
  }

  // Root-mean-square distance of the embeddings from their center.
  spread() {
    const [a, b, c, d] = this.th
    return Math.sqrt((a * a + b * b + c * c + d * d) / 2)
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.6, target: [0, 0.3, 0], az: 0, el: 50, grid: 0 })
  const L = [-3.9, 0]
  const R = [3.6, 0]
  const S = 1.75
  const RAD = 2.2
  const loop = new Ribbon(K + 1, C.muted, 0.06)
  loop.set(Array.from({ length: K + 1 }, (_, i) => [L[0] + RAD * states[i % K][0], L[1] + RAD * states[i % K][1]]), 0.02)
  const marks = states.map((s) => {
    const m = ball(C.truth, 0.1)
    m.position.set(L[0] + RAD * s[0], 0.1, L[1] + RAD * s[1])
    return m
  })
  const body = drone(C.truth, 1, 1.2)
  const shade = shadow(0.36)
  const zs = states.map(() => ball(C.est, 0.13))
  const cur = ball(C.est, 0.24)
  const ring = new Ribbon(K + 1, C.est, 0.05, 0.6)
  const miss = new Segs(K, C.meas)
  const frame = new Segs(4, C.grid)
  frame.begin()
  const q = 3.4
  for (const [a, b, c, d] of [[-q, -q, q, -q], [q, -q, q, q], [q, q, -q, q], [-q, q, -q, -q]]) frame.add(R[0] + a, 0.01, R[1] + b, R[0] + c, 0.01, R[1] + d)
  frame.end()
  stage.scene.add(loop.mesh, ...marks, body, shade, ...zs, cur, ring.mesh, miss.mesh, frame.mesh)
  stage.label('positions on the loop').pos.set(L[0], 0, L[1] - 2.9)
  stage.label('their embeddings', 'est').pos.set(R[0], 0, R[1] - 3.5)

  const lam = fig.slider('regularizer weight', { min: 0, max: 1, step: 0.02, value: 0, fmt: (v) => v.toFixed(2) })
  let sim
  let seed = 5
  const restart = () => (sim = new Jepa(seed++))
  restart()
  fig.button('new random encoder', restart)

  let t = 0
  stage.update = (dt) => {
    for (let k = 0; k < 2; k++) sim.step(lam.value)
    t += dt
    const i = Math.floor(t / 0.5) % K
    const p = states[i]
    body.position.set(L[0] + RAD * p[0], 1.2, L[1] + RAD * p[1])
    shade.position.set(L[0] + RAD * p[0], 0.012, L[1] + RAD * p[1])
    const E = states.map((_, k) => sim.embed(k).map((v) => Math.max(-q, Math.min(q, v * S))))
    miss.begin()
    E.forEach((e, k) => {
      zs[k].position.set(R[0] + e[0], 0.13, R[1] + e[1])
      const pr = sim.predict(k).map((v) => Math.max(-q, Math.min(q, v * S)))
      const n = E[(k + 1) % K]
      miss.add(R[0] + pr[0], 0.13, R[1] + pr[1], R[0] + n[0], 0.13, R[1] + n[1])
    })
    miss.end()
    cur.position.set(R[0] + E[i][0], 0.13, R[1] + E[i][1])
    ring.set([...E, E[0]].map((e) => [R[0] + e[0], R[1] + e[1]]), 0.05)
    fig.readout(
      `prediction loss: <b class="meas">${sim.pred().toFixed(3)}</b> · spread of the embeddings: <b class="est">${sim.spread().toFixed(2)}</b>`,
    )
  }
}
