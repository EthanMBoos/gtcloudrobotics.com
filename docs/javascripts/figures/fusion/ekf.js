// Planar robot on a fixed loop with a small EKF, shared by the drift and
// speed figures. State is [x, y, heading]. Odometry is speed plus a gyro with
// an unknown bias; fixes are range and bearing to known landmarks.

import { rng, wrap } from '../lib.js'

export const LANDMARKS = [[-6.4, 3.4], [0, 5], [6.4, 3.2], [6.2, -3.6], [0, -5], [-6.2, -3.4], [0, 0]]
export const BASE_SPEED = 1.2 // m/s at speed factor 1

export const path = (s) => [5 * Math.cos(s), 3.2 * Math.sin(s)]
const dpath = (s) => [-5 * Math.sin(s), 3.2 * Math.cos(s)]
const heading = (s) => {
  const d = dpath(s)
  return Math.atan2(d[1], d[0])
}

export class Sim {
  constructor(o = {}) {
    this.o = Object.assign(
      { seed: 1, speed: 1, gyroBias: 0.02, fixRate: 2, fixes: true, sigR: 0.15, sigB: 0.03, range: 5, sigV: 0.05, sigW: 0.02 },
      o,
    )
    this.reset()
  }

  reset() {
    this.r = rng(this.o.seed)
    this.s = 0
    this.t = 0
    this.nextFix = 0
    this.truth = [...path(0), heading(0)]
    this.dr = [...this.truth] // odometry only
    this.x = [...this.truth] // EKF mean
    this.P = [1e-4, 0, 0, 0, 1e-4, 0, 0, 0, 1e-4]
    this.fixed = []
  }

  step(dt) {
    const o = this.o
    const r = this.r
    const d = dpath(this.s)
    const dist = o.speed * BASE_SPEED * dt
    this.s += dist / Math.hypot(d[0], d[1])
    const th = heading(this.s)
    const w = wrap(th - this.truth[2]) / dt
    this.truth = [...path(this.s), th]
    this.t += dt

    // What the robot's own sensors report.
    const vm = (dist / dt) * (1 + o.sigV * r.n())
    const wm = w + o.gyroBias + o.sigW * r.n()

    for (const p of [this.dr, this.x]) {
      p[0] += vm * Math.cos(p[2]) * dt
      p[1] += vm * Math.sin(p[2]) * dt
      p[2] = wrap(p[2] + wm * dt)
    }

    // P = F P F' + Q
    const P = this.P
    const a = -vm * Math.sin(this.x[2]) * dt
    const b = vm * Math.cos(this.x[2]) * dt
    for (let j = 0; j < 3; j++) {
      P[j] += a * P[6 + j]
      P[3 + j] += b * P[6 + j]
    }
    for (let i = 0; i < 3; i++) {
      P[i * 3] += a * P[i * 3 + 2]
      P[i * 3 + 1] += b * P[i * 3 + 2]
    }
    const qp = 0.0025 * dt * Math.max(vm * vm, 0.1)
    P[0] += qp
    P[4] += qp
    P[8] += 0.0016 * dt

    this.fixed = []
    if (o.fixes && this.t >= this.nextFix) {
      this.nextFix = this.t + 1 / o.fixRate
      for (const lm of LANDMARKS) {
        const dx = lm[0] - this.truth[0]
        const dy = lm[1] - this.truth[1]
        const range = Math.hypot(dx, dy)
        if (range > o.range) continue
        const z = [range + o.sigR * r.n(), wrap(Math.atan2(dy, dx) - this.truth[2] + o.sigB * r.n())]
        this.update(lm, z)
        this.fixed.push(lm)
      }
    }
  }

  update(lm, z) {
    const x = this.x
    const P = this.P
    const dx = lm[0] - x[0]
    const dy = lm[1] - x[1]
    const q = dx * dx + dy * dy
    const range = Math.sqrt(q)
    const H = [-dx / range, -dy / range, 0, dy / q, -dx / q, -1]
    const PHt = []
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 2; k++) PHt[i * 2 + k] = P[i * 3] * H[k * 3] + P[i * 3 + 1] * H[k * 3 + 1] + P[i * 3 + 2] * H[k * 3 + 2]
    }
    const s00 = H[0] * PHt[0] + H[1] * PHt[2] + H[2] * PHt[4] + this.o.sigR ** 2
    const s01 = H[0] * PHt[1] + H[1] * PHt[3] + H[2] * PHt[5]
    const s10 = H[3] * PHt[0] + H[4] * PHt[2] + H[5] * PHt[4]
    const s11 = H[3] * PHt[1] + H[4] * PHt[3] + H[5] * PHt[5] + this.o.sigB ** 2
    const det = s00 * s11 - s01 * s10
    const y0 = z[0] - range
    const y1 = wrap(z[1] - (Math.atan2(dy, dx) - x[2]))
    const K = []
    for (let i = 0; i < 3; i++) {
      K[i * 2] = (PHt[i * 2] * s11 - PHt[i * 2 + 1] * s10) / det
      K[i * 2 + 1] = (-PHt[i * 2] * s01 + PHt[i * 2 + 1] * s00) / det
      x[i] += K[i * 2] * y0 + K[i * 2 + 1] * y1
    }
    x[2] = wrap(x[2])
    const HP = PHt.slice() // P is symmetric, so (H P)[k][j] = PHt[j][k]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) P[i * 3 + j] -= K[i * 2] * HP[j * 2] + K[i * 2 + 1] * HP[j * 2 + 1]
    }
  }

  err(p) {
    return Math.hypot(p[0] - this.truth[0], p[1] - this.truth[1])
  }
}

// RMS position error of the EKF over one lap, averaged over a few seeds.
export function lapRms(o, seeds = 3) {
  let sum = 0
  let n = 0
  for (let k = 0; k < seeds; k++) {
    const sim = new Sim({ ...o, seed: 11 + k })
    while (sim.s < 2 * Math.PI) {
      sim.step(1 / 60)
      sum += sim.err(sim.x) ** 2
      n++
    }
  }
  return Math.sqrt(sum / n)
}
