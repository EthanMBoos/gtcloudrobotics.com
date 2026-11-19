// Three targets, one sensor that reports unlabeled positions with misses and
// false alarms. Each track is a Kalman filter; the only thing that changes
// between the two modes is how detections are assigned to tracks.

import { C, rng, drone, ball, shadow, Ribbon, Ellipse, Segs } from '../lib.js'
import { CV } from './lsq.js'

export const SCAN = 0.2 // s between sensor scans
const GATE = 9.21 // chi-square, 2 dof, 99 %
const Q = 1 // m/s^2 of unmodeled acceleration
const ALT = 0.9
const B = [7, 4.6] // clutter is uniform over +-B

export const PATHS = [
  (t) => [5.4 * Math.cos(0.3 * t), 3.2 * Math.sin(0.3 * t)],
  (t) => [4.2 * Math.cos(0.45 * t + 2), 2.2 * Math.sin(0.45 * t + 2)],
  (t) => [4.8 * Math.cos(-0.36 * t + 4), 2.7 * Math.sin(-0.36 * t + 4)],
]

// One scan: noisy detections of the targets that were seen, plus clutter.
export function scan(t, r, { sigma, pd, clutter }) {
  const dets = []
  for (const p of PATHS) {
    if (r() > pd) continue
    const [x, y] = p(t)
    dets.push([x + sigma * r.n(), y + sigma * r.n()])
  }
  let n = 0
  for (let L = Math.exp(-clutter), q = r(); q > L; q *= r()) n++ // Poisson
  for (let i = 0; i < n; i++) dets.push([(2 * r() - 1) * B[0], (2 * r() - 1) * B[1]])
  return dets
}

export class Tracker {
  constructor(mode) {
    this.mode = mode
    this.swaps = 0
    this.tracks = PATHS.map((p, i) => {
      const a = p(0)
      const b = p(0.01)
      return { kf: new CV(a[0], a[1], (b[0] - a[0]) / 0.01, (b[1] - a[1]) / 0.01), id: i, det: -1, missed: 0 }
    })
  }

  step(t, dets, sigma) {
    const R = sigma * sigma
    const T = this.tracks
    for (const tr of T) tr.kf.predict(SCAN, Q)
    const cost = T.map((tr) => dets.map((d) => tr.kf.d2(d[0], d[1], R)))
    const pick = this.mode === 'nn' ? greedy(cost, dets.length) : best(cost, dets.length)
    T.forEach((tr, i) => {
      tr.det = pick[i]
      if (pick[i] < 0) tr.missed++
      else {
        tr.missed = 0
        tr.kf.update(dets[pick[i]][0], dets[pick[i]][1], R)
      }
    })
    // A track with no detection for 1 s restarts on a detection that no track
    // claimed in two scans running, which is rarely a false alarm.
    const free = dets.filter((_, j) => !pick.includes(j))
    for (const tr of T) {
      if (tr.missed < 5) continue
      for (const d of free) {
        const was = (this.free || []).find((o) => Math.hypot(d[0] - o[0], d[1] - o[1]) < 0.9)
        if (!was || d.taken) continue
        d.taken = true
        tr.kf = new CV(d[0], d[1], (d[0] - was[0]) / SCAN, (d[1] - was[1]) / SCAN, R, 2)
        tr.missed = 0
        break
      }
    }
    this.free = free
    // Which target is each track really following?
    const truth = PATHS.map((p) => p(t))
    for (const tr of T) {
      const d = truth.map((p) => Math.hypot(p[0] - tr.kf.x[0], p[1] - tr.kf.x[2]))
      const k = d.indexOf(Math.min(...d))
      if (k !== tr.id && d[k] + 0.5 < d[tr.id]) {
        tr.id = k
        this.swaps++
      }
    }
  }
}

// Nearest neighbor: tracks choose in order and never give a detection back.
function greedy(cost, n) {
  const used = new Set()
  return cost.map((row) => {
    let k = -1
    let c = GATE
    for (let j = 0; j < n; j++) if (!used.has(j) && row[j] < c) [k, c] = [j, row[j]]
    if (k >= 0) used.add(k)
    return k
  })
}

// Global assignment: the one-to-one pairing with the lowest total cost, where
// leaving a track unassigned costs as much as a detection on the gate.
function best(cost, n) {
  let bestCost = Infinity
  let bestPick = []
  const pick = []
  const used = new Array(n).fill(false)
  const go = (i, c) => {
    if (c >= bestCost) return
    if (i === cost.length) {
      bestCost = c
      bestPick = pick.slice()
      return
    }
    for (let j = 0; j < n; j++) {
      if (used[j] || cost[i][j] >= GATE) continue
      used[j] = true
      pick[i] = j
      go(i + 1, c + cost[i][j])
      used[j] = false
    }
    pick[i] = -1
    go(i + 1, c + GATE)
  }
  go(0, 0)
  return bestPick
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.6, target: [0, 0.4, 0], az: 0, el: 48, grid: 20 })
  const craft = PATHS.map(() => drone(C.truth, 1, 1.1))
  const shade = PATHS.map(() => shadow(0.3))
  const gates = PATHS.map(() => new Ellipse(C.est, 0.12))
  const trails = PATHS.map(() => new Ribbon(260, C.est, 0.07))
  const labels = PATHS.map((_, i) => stage.label('track ' + (i + 1), 'est'))
  const dots = Array.from({ length: 24 }, () => ball(C.meas, 0.09))
  const links = new Segs(PATHS.length, C.est)
  stage.scene.add(...craft, ...shade, ...gates.map((g) => g.group), ...trails.map((t) => t.mesh), ...dots, links.mesh)

  const mode = fig.choice([['nn', 'nearest neighbor'], ['global', 'global assignment']], 'nn')
  const clutter = fig.slider('false alarms per scan', { min: 0, max: 8, step: 0.5, value: 1, fmt: (v) => v.toFixed(1) })
  const miss = fig.slider('missed detections', { min: 0, max: 50, step: 5, value: 10, fmt: (v) => v + ' %' })
  const sigma = fig.slider('sensor noise', { min: 0.05, max: 0.6, step: 0.05, value: 0.25, fmt: (v) => v.toFixed(2) + ' m' })

  let r, trackers, hist, t, acc, dets, age
  function restart() {
    r = rng(9)
    trackers = { nn: new Tracker('nn'), global: new Tracker('global') }
    hist = { nn: PATHS.map(() => []), global: PATHS.map(() => []) }
    t = acc = 0
    age = 1
    dets = []
  }
  restart()
  fig.button('restart', restart)

  stage.update = (dt) => {
    t += dt
    acc += dt
    age += dt
    while (acc >= SCAN) {
      acc -= SCAN
      dets = scan(t, r, { sigma: sigma.value, pd: 1 - miss.value / 100, clutter: clutter.value })
      age = 0
      for (const m of ['nn', 'global']) {
        trackers[m].step(t, dets, sigma.value)
        trackers[m].tracks.forEach((tr, i) => {
          hist[m][i].push([tr.kf.x[0], tr.kf.x[2]])
          if (hist[m][i].length > 60) hist[m][i].shift()
        })
      }
    }
    PATHS.forEach((p, i) => {
      const [x, y] = p(t)
      craft[i].position.set(x, ALT, y)
      shade[i].position.set(x, 0.012, y)
    })
    const show = trackers[mode.value]
    const R = sigma.value ** 2
    links.begin()
    show.tracks.forEach((tr, i) => {
      const [x, , y] = tr.kf.x
      const S = tr.kf.P[0] + R
      gates[i].set(x, y, S, 0, S, Math.sqrt(GATE), ALT - 0.04)
      trails[i].set(hist[mode.value][i], ALT - 0.06)
      labels[i].pos.set(x, ALT + 0.2, y)
      if (tr.det >= 0 && dets[tr.det]) links.add(x, ALT, y, dets[tr.det][0], ALT, dets[tr.det][1])
    })
    links.end()
    const fade = Math.max(0.25, 1 - age / SCAN)
    dots.forEach((d, j) => {
      d.visible = j < dets.length
      if (!d.visible) return
      d.position.set(dets[j][0], ALT, dets[j][1])
      d.scale.setScalar(fade)
    })
    fig.readout(
      `tracks that changed target in ${t.toFixed(0)} s · nearest neighbor: <b class="meas">${trackers.nn.swaps}</b> · ` +
        `global assignment: <b class="est">${trackers.global.swaps}</b>`,
    )
  }
}
