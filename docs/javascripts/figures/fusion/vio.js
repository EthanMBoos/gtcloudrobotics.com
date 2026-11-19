// Visual-inertial odometry as a sliding window. Inertial odometry links each
// keyframe to the next and drifts. A stereo camera measures where nearby
// features are relative to the drone; features seen from several keyframes tie
// those keyframes together. Heading is taken as known, which keeps the problem
// linear: the unknowns are the keyframe positions and the feature positions.

import { C, rng, drone, shadow, ball, post, at, Ribbon, Segs } from '../lib.js'
import { Normal } from './lsq.js'

export const KF = 0.2 // s between keyframes
const ALT = 1.2
export const WINDOW = 8 // keyframes kept
const SIG_ODO = 0.1 // m, what the estimator assumes per inertial step
const camSigma = (range) => 0.02 * (1 + range / 2)

export const flight = (t) => [5 * Math.cos(0.25 * t), 3.2 * Math.sin(0.25 * t)]

export function features(seed = 4, n = 46) {
  const r = rng(seed)
  return Array.from({ length: n }, () => [(2 * r() - 1) * 7, (2 * r() - 1) * 4.8, 0.25 + r() * 0.7])
}

export class Vio {
  constructor(feats, seed = 1) {
    this.feats = feats
    this.r = rng(seed)
    this.t = 0
    this.truth = flight(0)
    this.imu = [...this.truth] // inertial odometry alone
    this.bias = [0.06, -0.04] // m/s velocity error, wanders slowly
    this.win = [{ est: [...this.truth], odo: null, obs: [] }]
    this.fest = new Map() // feature id -> estimated position, while in the window
    this.seen = []
  }

  get est() {
    return this.win[this.win.length - 1].est
  }

  step({ camera, range, drift }) {
    const r = this.r
    const prev = this.truth
    this.t += KF
    this.truth = flight(this.t)
    for (let k = 0; k < 2; k++) this.bias[k] += 0.004 * r.n()
    const d = [0, 1].map((k) => this.truth[k] - prev[k] + drift * this.bias[k] * KF + 0.004 * r.n())
    this.imu = [this.imu[0] + d[0], this.imu[1] + d[1]]

    // What the camera sees: features ahead of the drone and within range.
    const obs = []
    const v = [this.truth[0] - prev[0], this.truth[1] - prev[1]]
    this.feats.forEach((f, id) => {
      const dx = f[0] - this.truth[0]
      const dy = f[1] - this.truth[1]
      const dist = Math.hypot(dx, dy)
      if (dist > range || dx * v[0] + dy * v[1] < 0.35 * dist * Math.hypot(v[0], v[1])) return
      const s = camSigma(dist)
      obs.push({ id, z: [dx + s * r.n(), dy + s * r.n()], w: 1 / (s * s) })
    })
    this.seen = obs.map((o) => o.id)

    const last = this.win[this.win.length - 1]
    last.odo = d
    this.win.push({ est: [last.est[0] + d[0], last.est[1] + d[1]], odo: null, obs: camera ? obs : [] })
    while (this.win.length > WINDOW) this.win.shift()
    this.solve()
  }

  solve() {
    const W = this.win
    const K = W.length
    const ids = [...new Set(W.flatMap((k) => k.obs.map((o) => o.id)))]
    const col = new Map(ids.map((id, j) => [id, K + j]))
    const N = new Normal(K + ids.length)
    // The oldest keyframe is held where it was last estimated.
    N.add([0], [1], W[0].est[0], W[0].est[1], 1e5)
    for (let i = 0; i < K; i++) {
      if (i < K - 1) N.add([i, i + 1], [-1, 1], W[i].odo[0], W[i].odo[1], 1 / SIG_ODO ** 2)
      for (const o of W[i].obs) N.add([i, col.get(o.id)], [-1, 1], o.z[0], o.z[1], o.w)
    }
    const [X, Y] = N.solve()
    W.forEach((k, i) => (k.est = [X[i], Y[i]]))
    this.fest = new Map(ids.map((id) => [id, [X[col.get(id)], Y[col.get(id)]]]))
  }

  err(p) {
    return Math.hypot(p[0] - this.truth[0], p[1] - this.truth[1])
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.8, target: [0, 0.5, 0], az: 0, el: 42, grid: 20 })
  const feats = features()
  const posts = feats.map((f) => at(post(C.muted, f[2]), f[0], f[1]))
  const lit = feats.map((f) => at(ball(C.meas, 0.16), f[0], f[1], f[2]))
  const real = drone(C.truth, 1, 1.2)
  const shade = shadow(0.36)
  const ghost = drone(C.brass, 0.75, 1.2)
  const est = drone(C.est, 0.9, 1.2)
  const tImu = new Ribbon(700, C.brass, 0.06)
  const tEst = new Ribbon(700, C.est, 0.06)
  const winLine = new Ribbon(24, C.est, 0.12)
  const winDots = Array.from({ length: 24 }, () => ball(C.est, 0.1))
  const rays = new Segs(40, C.meas, 0.5)
  stage.scene.add(...posts, ...lit, real, shade, ghost, est, tImu.mesh, tEst.mesh, winLine.mesh, ...winDots, rays.mesh)
  const lImu = stage.label('inertial only', 'brass')
  const lEst = stage.label('camera + inertial', 'est')

  const camera = fig.toggle('camera', true)
  const range = fig.slider('camera range', { min: 1, max: 6, step: 0.25, value: 4, fmt: (v) => v.toFixed(2) + ' m' })
  const drift = fig.slider('inertial drift', { min: 0, max: 3, step: 0.1, value: 1, fmt: (v) => '×' + v.toFixed(1) })

  let sim, pImu, pEst, acc
  function restart() {
    sim = new Vio(feats, 2)
    pImu = []
    pEst = []
    acc = 0
  }
  restart()
  fig.button('restart', restart)

  stage.update = (dt) => {
    acc += dt
    while (acc >= KF) {
      acc -= KF
      sim.step({ camera: camera.value, range: range.value, drift: drift.value })
      pImu.push(sim.imu)
      pEst.push(sim.est)
      if (pImu.length > 700) {
        pImu.shift()
        pEst.shift()
      }
      if (sim.err(sim.imu) > 7) restart()
    }
    // Draw between keyframes by sliding everything along the true motion.
    const f = acc / KF
    const now = flight(sim.t + acc)
    const off = [now[0] - sim.truth[0], now[1] - sim.truth[1]]
    const place = (o, p) => o.position.set(p[0] + off[0], ALT, p[1] + off[1])
    place(real, sim.truth)
    place(ghost, sim.imu)
    place(est, sim.est)
    shade.position.set(now[0], 0.012, now[1])
    tImu.set(pImu, ALT - 0.03)
    tEst.set(pEst, ALT - 0.02)
    winLine.set(sim.win.map((k) => k.est), ALT)
    winDots.forEach((m, i) => {
      m.visible = i < sim.win.length
      if (m.visible) m.position.set(sim.win[i].est[0], ALT, sim.win[i].est[1])
    })
    rays.begin()
    lit.forEach((m, id) => {
      m.visible = camera.value && sim.seen.includes(id)
      if (m.visible) rays.add(now[0], ALT, now[1], feats[id][0], feats[id][2], feats[id][1])
    })
    rays.end()
    rays.mesh.material.opacity = 0.5 * (1 - 0.6 * f)
    lImu.pos.set(sim.imu[0] + off[0], ALT + 0.3, sim.imu[1] + off[1])
    lEst.pos.set(sim.est[0] + off[0], ALT + 0.3, sim.est[1] + off[1])
    lEst.dy = 46
    fig.readout(
      `inertial only: <b class="brass">${sim.err(sim.imu).toFixed(2)} m</b> off · ` +
        (camera.value ? 'camera + inertial' : 'camera off') +
        `: <b class="est">${sim.err(sim.est).toFixed(2)} m</b> off · state: ${sim.win.length} poses, ${sim.fest.size} features`,
    )
  }
}
