// Localization and tracking in one estimate. A rover with noisy odometry
// gets an absolute fix from a landmark only now and then. It also measures
// the position of a drone relative to itself. Two estimators run on the same
// data. The separate one localizes the rover from odometry and fixes, and
// tracks the drone from measurements placed with that pose. The joint one is
// a single Kalman filter over the rover, the drone, and the drone's velocity.
// The heading is taken as known, and the drone's true motion is drawn from
// the motion model that both estimators use (a velocity that changes at
// random and decays), so both are exact Kalman filters for what they are
// given. The drone turns back at the edge of the scene, which the model does
// not know about.

import { C, rng, rover, drone, shadow, Ribbon, Ellipse, Segs } from '../lib.js'

export const DT = 0.05
const QR = 0.25 // m per sqrt(s): odometry drift
const S_REL = 0.08 // m, relative measurement of the drone
const S_FIX = 0.1 // m, landmark fix
const REL_EVERY = 2 // steps (10 Hz)

export const ego = (t) => [5 * Math.cos(0.18 * t), 3.2 * Math.sin(0.18 * t)]
const egoV = (t) => [-0.9 * Math.sin(0.18 * t), 0.576 * Math.cos(0.18 * t)]
const TAU = 3 // s, how long the drone's velocity persists
const Q0 = 0.04 // m/s per sqrt(s): how fast its velocity changes at agility 1
const BOX = [5.6, 3.3]

const mul3 = (A, B) => {
  const out = new Float64Array(9)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) out[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]
  return out
}

export class Pair {
  constructor(seed = 1) {
    this.r = rng(seed)
    this.n = 0
    this.t = 0
    this.o = [1.4, -0.8]
    this.v = [0, 0]
    this.sinceFix = 0
    this.fixed = false
    const e = ego(0)
    const o = this.o
    // Joint: per axis [rover, drone, drone velocity], one shared 3x3 covariance.
    this.jx = [[e[0], o[0], 0], [e[1], o[1], 0]]
    this.jP = Float64Array.from([0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.0001])
    // Separate: rover alone, then a tracker.
    this.sr = [...e]
    this.sPr = 0.01
    this.so = [[o[0], 0], [o[1], 0]]
    this.sP = [0.01, 0, 0.0001]
    this.sum = { jr: 0, jo: 0, sr: 0, so: 0 }
    this.count = 0
  }

  step({ every, agility }) {
    const q = Q0 * agility
    const A = 1 - DT / TAU
    const v = egoV(this.t)
    const s = QR / Math.sqrt(DT)
    const u = [v[0] + s * this.r.n(), v[1] + s * this.r.n()]
    this.n++
    this.t = this.n * DT
    const e = ego(this.t)
    const o = this.o
    for (let k = 0; k < 2; k++) {
      o[k] += this.v[k] * DT
      this.v[k] = A * this.v[k] + q * Math.sqrt(DT) * this.r.n()
      if (Math.abs(o[k]) > BOX[k]) this.v[k] = -Math.sign(o[k]) * Math.abs(this.v[k])
    }
    const Q = [0, 0, q * q * DT]

    // Predict.
    for (let k = 0; k < 2; k++) {
      this.jx[k][0] += u[k] * DT
      this.jx[k][1] += this.jx[k][2] * DT
      this.jx[k][2] *= A
      this.sr[k] += u[k] * DT
      this.so[k][0] += this.so[k][1] * DT
      this.so[k][1] *= A
    }
    const F = Float64Array.from([1, 0, 0, 0, 1, DT, 0, 0, A])
    const Ft = Float64Array.from([1, 0, 0, 0, 1, 0, 0, DT, A])
    this.jP = mul3(mul3(F, this.jP), Ft)
    this.jP[0] += QR * QR * DT
    this.jP[4] += Q[0]
    this.jP[5] += Q[1]
    this.jP[7] += Q[1]
    this.jP[8] += Q[2]
    this.sPr += QR * QR * DT
    const [a, b, c] = this.sP
    this.sP = [a + 2 * DT * b + DT * DT * c, A * (b + DT * c), A * A * c + Q[2]]

    // Landmark fix on the rover.
    this.sinceFix += DT
    this.fixed = false
    if (this.sinceFix >= every) {
      this.sinceFix = 0
      this.fixed = true
      const z = [e[0] + S_FIX * this.r.n(), e[1] + S_FIX * this.r.n()]
      this.update([1, 0, 0], z, S_FIX * S_FIX)
      const k = this.sPr / (this.sPr + S_FIX * S_FIX)
      for (let i = 0; i < 2; i++) this.sr[i] += k * (z[i] - this.sr[i])
      this.sPr *= 1 - k
    }

    // Relative measurement of the drone.
    if (this.n % REL_EVERY === 0) {
      const z = [o[0] - e[0] + S_REL * this.r.n(), o[1] - e[1] + S_REL * this.r.n()]
      this.update([-1, 1, 0], z, S_REL * S_REL)
      // The tracker places the measurement with the rover's estimate, and
      // adds the rover's uncertainty to the measurement noise.
      const R = S_REL * S_REL + this.sPr
      const [p, pv, vv] = this.sP
      const S = p + R
      for (let i = 0; i < 2; i++) {
        const inn = this.sr[i] + z[i] - this.so[i][0]
        this.so[i][0] += (p / S) * inn
        this.so[i][1] += (pv / S) * inn
      }
      this.sP = [p - (p * p) / S, pv - (p * pv) / S, vv - (pv * pv) / S]
    }

    const d = (x, y, p) => (x - p[0]) ** 2 + (y - p[1]) ** 2
    this.sum.jr += d(this.jx[0][0], this.jx[1][0], e)
    this.sum.jo += d(this.jx[0][1], this.jx[1][1], o)
    this.sum.sr += d(this.sr[0], this.sr[1], e)
    this.sum.so += d(this.so[0][0], this.so[1][0], o)
    this.count++
  }

  // Kalman update of the joint state with a scalar-per-axis measurement.
  update(H, z, R) {
    const P = this.jP
    const PH = [0, 1, 2].map((i) => P[i * 3] * H[0] + P[i * 3 + 1] * H[1] + P[i * 3 + 2] * H[2])
    const S = H[0] * PH[0] + H[1] * PH[1] + H[2] * PH[2] + R
    const K = PH.map((x) => x / S)
    for (let k = 0; k < 2; k++) {
      const x = this.jx[k]
      const inn = z[k] - (H[0] * x[0] + H[1] * x[1] + H[2] * x[2])
      for (let i = 0; i < 3; i++) x[i] += K[i] * inn
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P[i * 3 + j] -= K[i] * PH[j]
  }

  rms() {
    const f = (k) => Math.sqrt(this.sum[k] / this.count)
    return { jr: f('jr'), jo: f('jo'), sr: f('sr'), so: f('so') }
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.8, target: [0, 0.4, 0], az: 0, el: 42, grid: 20 })
  const ALT = 1.3
  const lap = new Ribbon(130, C.muted, 0.05, 0.45)
  lap.set(Array.from({ length: 129 }, (_, i) => ego((i / 128) * 2 * Math.PI / 0.18)), 0.015)
  const bot = rover(C.truth)
  const botEst = rover(C.est, 0.9)
  const ell = new Ellipse(C.est)
  const obj = drone(C.truth, 1, 1.2)
  const objEst = drone(C.est, 0.85, 1.2)
  const shade = shadow(0.36)
  const ray = new Segs(2, C.meas, 0.6)
  stage.scene.add(lap.mesh, bot, botEst, ell.group, obj, objEst, shade, ray.mesh)
  const lFix = stage.label('landmark fix', 'meas')

  const mode = fig.choice([['sep', 'localize and track separately'], ['joint', 'one filter for both']], 'sep')
  const every = fig.slider('time between landmark fixes', { min: 2, max: 40, step: 1, value: 15, fmt: (v) => v + ' s' })
  const agility = fig.slider('how erratically the drone moves', { min: 0.25, max: 4, step: 0.25, value: 1, fmt: (v) => '×' + v.toFixed(2) })

  let s, acc, flash
  function restart() {
    s = new Pair(3)
    acc = flash = 0
  }
  every.on = agility.on = restart
  restart()

  stage.update = (dt) => {
    acc += dt
    while (acc >= DT) {
      acc -= DT
      s.step({ every: every.value, agility: agility.value })
      if (s.fixed) flash = 1
    }
    flash = Math.max(0, flash - dt * 1.5)
    const e = ego(s.t)
    const o = s.o
    const j = mode.value === 'joint'
    const r = j ? [s.jx[0][0], s.jx[1][0]] : s.sr
    const t = j ? [s.jx[0][1], s.jx[1][1]] : [s.so[0][0], s.so[1][0]]
    const v = egoV(s.t)
    const th = Math.atan2(v[1], v[0])
    bot.setPose(e[0], e[1], th)
    botEst.setPose(r[0], r[1], th)
    const pr = j ? s.jP[0] : s.sPr
    ell.set(r[0], r[1], pr, 0, pr, 2)
    obj.position.set(o[0], ALT, o[1])
    shade.position.set(o[0], 0.012, o[1])
    objEst.position.set(t[0], ALT, t[1])
    ray.begin()
    ray.add(e[0], 0.45, e[1], o[0], ALT, o[1])
    ray.end()
    lFix.show = flash > 0
    lFix.pos.set(e[0], 0.9, e[1])
    const m = s.rms()
    const cm = (x) => (x * 100).toFixed(0) + ' cm'
    fig.readout(
      `average error, separately · rover <b>${cm(m.sr)}</b>, drone <b>${cm(m.so)}</b> · in one filter · rover <b class="est">${cm(m.jr)}</b>, drone <b class="est">${cm(m.jo)}</b>`,
    )
  }
}
