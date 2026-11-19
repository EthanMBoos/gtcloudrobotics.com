// Filtering against smoothing on the same measurements. A filter keeps only
// the newest pose, so the path it reported stays as it was reported. A
// fixed-lag smoother keeps the last few poses as variables in a small factor
// graph, so a position fix also corrects the poses before it.

import { C, rng, rover, ball, Ribbon, Segs } from '../lib.js'
import { path } from './ekf.js'
import { Normal } from './lsq.js'

export const KF = 0.25 // s between poses
const SPEED = 0.26 // rad/s round the loop
const SIG_ODO = 0.07
const SIG_FIX = 0.2
const KEEP = 260

export class Smoother {
  constructor(seed = 1) {
    this.r = rng(seed)
    this.k = 0
    this.truth = path(0)
    // Window of poses, oldest first. prior = [mean x, mean y, variance] is
    // everything older than the window, summarized by a Kalman filter.
    this.win = [{ est: [...this.truth], truth: this.truth, odo: null, fix: null }]
    this.prior = [...this.truth, 1e-4]
    this.live = [] // each pose as it was first estimated
    this.final = [] // each pose as it left the window
    this.truths = []
    this.fixes = []
  }

  // headingErr (rad) rotates the odometry, as a miscalibrated compass would.
  step({ lag, every, headingErr }) {
    const r = this.r
    const prev = this.truth
    this.k++
    this.truth = path(this.k * KF * SPEED)
    const th = Math.atan2(this.truth[1] - prev[1], this.truth[0] - prev[0]) + headingErr
    const dist = Math.hypot(this.truth[0] - prev[0], this.truth[1] - prev[1])
    const odo = [dist * Math.cos(th) + 0.01 * r.n(), dist * Math.sin(th) + 0.01 * r.n()]
    const fix = this.k % every === 0 ? [this.truth[0] + SIG_FIX * r.n(), this.truth[1] + SIG_FIX * r.n()] : null
    if (fix) this.fixes.push(fix)
    if (this.fixes.length > 8) this.fixes.shift()

    const last = this.win[this.win.length - 1]
    last.odo = odo
    this.win.push({ est: [last.est[0] + odo[0], last.est[1] + odo[1]], truth: this.truth, odo: null, fix })

    // Poses that leave the window are folded into the prior, exactly.
    while (this.win.length > lag) {
      const a = this.win.shift()
      let [mx, my, v] = this.prior
      if (a.fix) {
        const g = v / (v + SIG_FIX ** 2)
        mx += g * (a.fix[0] - mx)
        my += g * (a.fix[1] - my)
        v *= 1 - g
      }
      this.prior = [mx + a.odo[0], my + a.odo[1], v + SIG_ODO ** 2]
      this.final.push(a.est)
      this.truths.push(a.truth)
    }
    const W = this.win
    const N = new Normal(W.length)
    N.add([0], [1], this.prior[0], this.prior[1], 1 / this.prior[2])
    W.forEach((p, i) => {
      if (p.fix) N.add([i], [1], p.fix[0], p.fix[1], 1 / SIG_FIX ** 2)
      if (i < W.length - 1) N.add([i, i + 1], [-1, 1], p.odo[0], p.odo[1], 1 / SIG_ODO ** 2)
    })
    const [X, Y] = N.solve()
    W.forEach((p, i) => (p.est = [X[i], Y[i]]))
    this.live.push(W[W.length - 1].est)
    for (const a of [this.live, this.final, this.truths]) while (a.length > KEEP) a.shift()
  }

  // RMS error of the path as first reported, and as finally smoothed.
  rms() {
    const all = [...this.truths, ...this.win.map((p) => p.truth)]
    const sm = [...this.final, ...this.win.map((p) => p.est)]
    const n = Math.min(all.length, this.live.length)
    let a = 0
    let b = 0
    for (let i = 1; i <= n; i++) {
      const t = all[all.length - i]
      const l = this.live[this.live.length - i]
      const s = sm[sm.length - i]
      a += (l[0] - t[0]) ** 2 + (l[1] - t[1]) ** 2
      b += (s[0] - t[0]) ** 2 + (s[1] - t[1]) ** 2
    }
    return [Math.sqrt(a / n), Math.sqrt(b / n)]
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.8, target: [0, 0.3, 0], az: 0, el: 44, grid: 20 })
  const lap = new Ribbon(130, C.muted, 0.05, 0.45)
  lap.set(Array.from({ length: 129 }, (_, i) => path((i / 128) * 2 * Math.PI)), 0.015)
  const tLive = new Ribbon(KEEP, C.brass, 0.06)
  const tSmooth = new Ribbon(KEEP + 64, C.est, 0.07)
  const nodes = Array.from({ length: 60 }, () => ball(C.est, 0.1))
  const fixDots = Array.from({ length: 8 }, () => ball(C.meas, 0.12))
  const pulls = new Segs(60, C.meas)
  const truthBot = rover(C.truth)
  const estBot = rover(C.est, 0.9)
  stage.scene.add(lap.mesh, tLive.mesh, tSmooth.mesh, ...nodes, ...fixDots, pulls.mesh, truthBot, estBot)
  const lLive = stage.label('as first reported', 'brass')
  const lSmooth = stage.label('after smoothing', 'est')
  const lFix = stage.label('position fix', 'meas')

  const lag = fig.slider('poses kept', { min: 1, max: 60, step: 1, value: 30, fmt: (v) => (v === 1 ? '1 (a filter)' : v) })
  const every = fig.slider('a fix every', { min: 4, max: 40, step: 2, value: 16, fmt: (v) => (v * KF).toFixed(1) + ' s' })
  const bias = fig.slider('heading error', { min: 0, max: 15, step: 1, value: 8, fmt: (v) => v + '°' })

  let sim, acc
  function restart() {
    sim = new Smoother(4)
    acc = 0
  }
  restart()
  fig.button('restart', restart)

  stage.update = (dt) => {
    acc += dt
    while (acc >= KF) {
      acc -= KF
      const e = ((bias.value * Math.PI) / 180) * Math.cos(sim.k * KF * 0.05)
      sim.step({ lag: lag.value, every: every.value, headingErr: e })
    }
    const W = sim.win
    const head = W[W.length - 1]
    const prev = W.length > 1 ? W[W.length - 2].est : sim.final[sim.final.length - 1] || head.est
    const th = Math.atan2(head.est[1] - prev[1], head.est[0] - prev[0])
    const tPrev = W.length > 1 ? W[W.length - 2].truth : sim.truths[sim.truths.length - 1] || head.truth
    truthBot.setPose(head.truth[0], head.truth[1], Math.atan2(head.truth[1] - tPrev[1], head.truth[0] - tPrev[0]))
    estBot.setPose(head.est[0], head.est[1], th)
    tLive.set(sim.live, 0.02)
    tSmooth.set([...sim.final, ...W.map((p) => p.est)], 0.03)
    pulls.begin()
    nodes.forEach((m, i) => {
      m.visible = i < W.length && W.length > 1
      if (!m.visible) return
      m.position.set(W[i].est[0], 0.1, W[i].est[1])
      if (W[i].fix) pulls.add(W[i].est[0], 0.1, W[i].est[1], W[i].fix[0], 0.1, W[i].fix[1])
    })
    pulls.end()
    fixDots.forEach((m, i) => {
      m.visible = i < sim.fixes.length
      if (m.visible) m.position.set(sim.fixes[i][0], 0.1, sim.fixes[i][1])
    })
    const lastFix = sim.fixes[sim.fixes.length - 1]
    lFix.show = !!lastFix
    if (lastFix) lFix.pos.set(lastFix[0], 0.3, lastFix[1])
    const back = sim.live[Math.max(0, sim.live.length - 26)]
    lLive.show = lSmooth.show = !!back && lag.value > 1
    if (back) {
      lLive.pos.set(back[0], 0.2, back[1])
      const sm = [...sim.final, ...W.map((p) => p.est)]
      const sb = sm[Math.max(0, sm.length - 26)]
      lSmooth.pos.set(sb[0], 0.2, sb[1])
      lSmooth.dy = 44
    }
    const [a, b] = sim.rms()
    fig.readout(
      `path error, as first reported: <b class="brass">${(a * 100).toFixed(0)} cm</b> · after smoothing: <b class="est">${(b * 100).toFixed(0)} cm</b> RMS`,
    )
  }
}
