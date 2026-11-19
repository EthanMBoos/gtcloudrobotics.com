// How far to trust a measurement that states its own noise. A sensor at the
// origin reports the position of a drone with noise that grows with range.
// A constant-velocity Kalman filter is told a noise level that is the true
// one multiplied by a factor. When the factor is below one, the filter's
// ellipse is too small and the truth falls outside it more often than the
// filter claims. The "detector" here is a noise model, not a network.

import { C, rng, drone, ball, post, shadow, Ribbon, Ellipse, at } from '../lib.js'
import { CV } from './lsq.js'

export const SCAN = 0.1
const Q = 2.2 // m/s^2, chosen so that the filter is consistent at factor 1
const GATE = 9.21
export const K95 = 2.448 // 95 % of a 2-d Gaussian lies within this many sigma

export const path = (t) => [5.2 * Math.cos(0.3 * t), 3.3 * Math.sin(0.6 * t)]
export const SENSOR = [-6.6, 0]
export const sigmaAt = (x, y) => 0.08 + 0.05 * Math.hypot(x - SENSOR[0], y - SENSOR[1])

export class Track {
  constructor(seed = 1) {
    this.r = rng(seed)
    this.t = 0
    const p = path(0)
    this.kf = new CV(p[0], p[1], 0, 1.98, 0.05, 0.5)
    this.inside = 0
    this.n = 0
    this.e2 = 0
    this.rejected = 0
    this.z = p
  }

  step({ factor, gate }) {
    this.t += SCAN
    const p = path(this.t)
    const s = sigmaAt(p[0], p[1])
    this.z = [p[0] + s * this.r.n(), p[1] + s * this.r.n()]
    this.kf.predict(SCAN, Q)
    const R = (factor * s) ** 2
    this.ok = !gate || this.kf.d2(this.z[0], this.z[1], R) < GATE
    if (this.ok) this.kf.update(this.z[0], this.z[1], R)
    else this.rejected++
    const d2 = (this.kf.x[0] - p[0]) ** 2 + (this.kf.x[2] - p[1]) ** 2
    this.hit = d2 < K95 * K95 * this.kf.P[0]
    this.inside += this.hit ? 1 : 0
    this.e2 += d2
    this.n++
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.6, target: [0, 0.4, 0], az: 0, el: 48, grid: 20 })
  const ALT = 0.9
  const real = drone(C.truth, 1, 1.15)
  const shade = shadow(0.32)
  const ell = new Ellipse(C.est, 0.16)
  const dot = ball(C.est, 0.1)
  const trail = new Ribbon(200, C.est, 0.06)
  const dets = Array.from({ length: 16 }, () => ball(C.meas, 0.07))
  stage.scene.add(real, shade, ell.group, dot, trail.mesh, ...dets, at(post(C.truth, 1), SENSOR[0], SENSOR[1]))
  stage.label('sensor').pos.set(SENSOR[0], 1.25, SENSOR[1])
  const lE = stage.label('where the filter says the drone is', 'est')

  const factor = fig.slider('stated noise, as a multiple of the true noise', { min: 0.2, max: 3, step: 0.05, value: 0.4, fmt: (v) => '×' + v.toFixed(2) })
  const gate = fig.toggle('reject detections outside the gate', false)

  let sim, acc, pts, zs
  function restart() {
    sim = new Track(4)
    acc = 0
    pts = []
    zs = []
  }
  factor.on = gate.on = restart
  restart()

  stage.update = (dt) => {
    acc += dt
    while (acc >= SCAN) {
      acc -= SCAN
      sim.step({ factor: factor.value, gate: gate.value })
      pts.push([sim.kf.x[0], sim.kf.x[2]])
      if (pts.length > 200) pts.shift()
      zs.push(sim.z)
      if (zs.length > dets.length) zs.shift()
    }
    const p = path(sim.t + acc)
    real.position.set(p[0], ALT, p[1])
    shade.position.set(p[0], 0.012, p[1])
    const k = sim.kf
    ell.set(k.x[0], k.x[2], k.P[0], 0, k.P[0], K95)
    dot.position.set(k.x[0], 0.1, k.x[2])
    trail.set(pts, 0.03)
    dets.forEach((d, i) => {
      const z = zs[zs.length - 1 - i]
      d.visible = !!z
      if (z) d.position.set(z[0], 0.08, z[1])
    })
    lE.pos.set(k.x[0], 0.2, k.x[2])
    lE.dy = 30
    fig.readout(
      `the filter claims the drone is inside the ellipse 95% of the time · measured so far: <b class="est">${sim.n ? ((sim.inside / sim.n) * 100).toFixed(0) : 0}%</b> · average error: <b>${sim.n ? (Math.sqrt(sim.e2 / sim.n) * 100).toFixed(0) : 0} cm</b>` +
        (gate.value ? ` · detections rejected: <b class="meas">${sim.n ? ((sim.rejected / sim.n) * 100).toFixed(0) : 0}%</b>` : ''),
    )
  }
}
