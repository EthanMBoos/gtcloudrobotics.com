// Physics plus a learned residual. A planar drone tracks a figure-eight in
// wind. Its controller knows the rigid-body model and cancels whatever
// aerodynamic force its residual model predicts. Three residuals run on the
// same wind: none, one fitted at a single wind speed, and one whose
// coefficients are adapted in flight by recursive least squares. Drag is
// linear in the air speed, so the true force is exactly b + k * v per axis and
// the adapted model can represent it.

import { C, rng, drone, shadow, ball, Ribbon, Segs } from '../lib.js'

const DT = 1 / 50
const DRAG = 0.35
const KP = 6
const KD = 4
export const W0 = 4 // m/s, the wind in which the fixed residual was fitted
const DIR = [0.5, 0.866]
const ALT = 1.2

export const ref = (t) => [4.6 * Math.sin(0.5 * t), 2.3 * Math.sin(t)]
const refV = (t) => [2.3 * Math.cos(0.5 * t), 2.3 * Math.cos(t)]
const refA = (t) => [-1.15 * Math.sin(0.5 * t), -2.3 * Math.sin(t)]
export const windAt = (t, W) => {
  const g = W * (1 + 0.25 * Math.sin(0.7 * t))
  return [g * DIR[0], g * DIR[1]]
}

export class Flight {
  constructor(mode, seed = 1) {
    this.mode = mode // 'none' | 'fixed' | 'adapt'
    this.r = rng(seed)
    this.t = 0
    this.p = ref(0)
    this.v = refV(0)
    // Per axis: parameters [b, k] and the 2x2 covariance of the estimator.
    this.th = [[0, 0], [0, 0]]
    this.P = [[10, 0, 10], [10, 0, 10]]
    this.e2 = 0
    this.n = 0
    this.err = 0
  }

  fhat(k) {
    if (this.mode === 'none') return 0
    if (this.mode === 'fixed') return DRAG * W0 * DIR[k] - DRAG * this.v[k]
    return this.th[k][0] + this.th[k][1] * this.v[k]
  }

  step(W) {
    const t = (this.t += DT)
    const r = ref(t)
    const rv = refV(t)
    const ra = refA(t)
    const w = windAt(t, W)
    for (let k = 0; k < 2; k++) {
      const u = ra[k] + KP * (r[k] - this.p[k]) + KD * (rv[k] - this.v[k]) - this.fhat(k)
      const a = u + DRAG * (w[k] - this.v[k])
      if (this.mode === 'adapt') {
        // The accelerometer gives the force the model left out.
        const y = a + 0.15 * this.r.n() - u
        const h = [1, this.v[k]]
        const [p0, p1, p2] = this.P[k]
        const Ph = [p0 + p1 * h[1], p1 + p2 * h[1]]
        const s = 0.985 + Ph[0] + Ph[1] * h[1]
        const g = [Ph[0] / s, Ph[1] / s]
        const e = y - this.th[k][0] - this.th[k][1] * h[1]
        this.th[k][0] += g[0] * e
        this.th[k][1] += g[1] * e
        this.P[k] = [(p0 - g[0] * Ph[0]) / 0.985, (p1 - g[0] * Ph[1]) / 0.985, (p2 - g[1] * Ph[1]) / 0.985]
      } else this.r.n()
      this.v[k] += a * DT
      this.p[k] += this.v[k] * DT
    }
    const d2 = (r[0] - this.p[0]) ** 2 + (r[1] - this.p[1]) ** 2
    this.e2 += d2
    this.n++
    this.err += (d2 - this.err) * 0.004 // running mean square, about 5 s
  }

  rms() {
    return Math.sqrt(this.e2 / this.n)
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.4, target: [0, 0.5, 0], az: 0, el: 44, grid: 20 })
  const lap = new Ribbon(260, C.goal, 0.06, 0.7)
  lap.set(Array.from({ length: 259 }, (_, i) => ref((i / 258) * 4 * Math.PI)), ALT - 0.02)
  const body = drone(C.truth, 1, 1.25)
  const shade = shadow(0.38)
  const target = ball(C.goal, 0.12)
  const trail = new Ribbon(300, C.truth, 0.06)
  const gap = new Segs(1, C.meas)
  const streaks = new Segs(26, C.muted, 0.7)
  stage.scene.add(lap.mesh, body, shade, target, trail.mesh, gap.mesh, streaks.mesh)
  const lRef = stage.label('reference', 'goal')
  lRef.pos.set(-3.3, ALT + 0.2, -2.25)

  const mode = fig.choice([['none', 'physics only'], ['fixed', 'fixed residual'], ['adapt', 'adapting residual']], 'none')
  const wind = fig.slider('wind', { min: 0, max: 12, step: 0.5, value: 8, fmt: (v) => v.toFixed(1) + ' m/s' })

  const sims = { none: new Flight('none'), fixed: new Flight('fixed'), adapt: new Flight('adapt') }
  const r = rng(9)
  const air = Array.from({ length: 26 }, () => [(2 * r() - 1) * 8, (2 * r() - 1) * 5.5])
  let acc = 0
  let pts = []
  mode.on = () => (pts = [])

  stage.update = (dt) => {
    acc += dt
    while (acc >= DT) {
      acc -= DT
      for (const k in sims) sims[k].step(wind.value)
      const s = sims[mode.value]
      if (s.n % 3 === 0) {
        pts.push([...s.p])
        if (pts.length > 300) pts.shift()
      }
    }
    const s = sims[mode.value]
    const g = ref(s.t)
    body.position.set(s.p[0], ALT, s.p[1])
    shade.position.set(s.p[0], 0.012, s.p[1])
    target.position.set(g[0], ALT, g[1])
    trail.set(pts, ALT - 0.01)
    gap.begin()
    gap.add(s.p[0], ALT, s.p[1], g[0], ALT, g[1])
    gap.end()
    const w = windAt(s.t, wind.value)
    streaks.begin()
    for (const a of air) {
      a[0] += w[0] * dt * 0.5
      a[1] += w[1] * dt * 0.5
      if (a[0] > 8) a[0] -= 16
      if (a[1] > 5.5) a[1] -= 11
      streaks.add(a[0], 0.6, a[1], a[0] - w[0] * 0.09, 0.6, a[1] - w[1] * 0.09)
    }
    streaks.end()
    const cm = (k) => (Math.sqrt(sims[k].err) * 100).toFixed(0)
    fig.readout(
      `tracking error · physics only: <b>${cm('none')} cm</b> · fixed residual: <b>${cm('fixed')} cm</b> · adapting residual: <b class="goal">${cm('adapt')} cm</b>`,
    )
  }
}
