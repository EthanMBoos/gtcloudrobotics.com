// Submaps with unknown scale. A rover drives a loop and builds a submap at
// each of twelve places. Each submap is correct in shape but has its own
// scale, as the output of a feed-forward reconstruction model does. Matching
// neighboring submaps gives their relative rotation, translation (in the
// first submap's units), and scale. A rigid pose graph ignores the scale and
// treats every translation as metric; a similarity pose graph adds one scale
// per submap. The scale of the first submap is taken as known.

import { C, rng, rover, ball, Ribbon, wrap } from '../lib.js'
import { gaussNewton } from './lsq.js'

export const N = 12
const RX = 5.2
const RY = 3.3
const SEE = 2.6 // m, how far a submap reaches
const S_T = 0.03 // noise of a relative translation, in submap units
const S_R = 0.01 // rad
const S_L = 0.01 // noise of a relative log scale

export const POSES = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * 2 * Math.PI
  return [RX * Math.cos(a), RY * Math.sin(a), Math.atan2(RY * Math.cos(a), -RX * Math.sin(a))]
})
export const MARKS = []
{
  const r = rng(5)
  for (let k = 0; k < 44; k++) {
    const a = (k / 44) * 2 * Math.PI + 0.1 * r.n()
    const f = k % 2 ? 1.28 : 0.72
    MARKS.push([f * RX * Math.cos(a) + 0.2 * r.n(), f * RY * Math.sin(a) + 0.2 * r.n()])
  }
}

const rot = (th, x, y) => [Math.cos(th) * x - Math.sin(th) * y, Math.sin(th) * x + Math.cos(th) * y]

export function build(spread, seed) {
  const r = rng(seed)
  const s = POSES.map((_, i) => (i ? Math.exp(spread * r.n()) : 1))
  const edges = []
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N
    const d = rot(-POSES[i][2], POSES[j][0] - POSES[i][0], POSES[j][1] - POSES[i][1])
    edges.push({
      i,
      j,
      d: [d[0] / s[i] + S_T * r.n(), d[1] / s[i] + S_T * r.n()],
      th: wrap(POSES[j][2] - POSES[i][2] + S_R * r.n()),
      l: Math.log(s[j] / s[i]) + S_L * r.n(),
    })
  }
  // Each submap holds the landmarks near it, in its own frame and units.
  const local = POSES.map((p, i) =>
    MARKS.map((m, k) => [k, m]).filter(([, m]) => Math.hypot(m[0] - p[0], m[1] - p[1]) < SEE).map(([k, m]) => {
      const q = rot(-p[2], m[0] - p[0], m[1] - p[1])
      return [k, q[0] / s[i], q[1] / s[i]]
    }),
  )
  return { s, edges, local }
}

// Returns [x, y, heading, scale] per submap. Submap 0 is fixed at the truth.
export function solve(w, withScale) {
  const D = withScale ? 4 : 3
  const x = new Float64Array((N - 1) * D)
  const get = (v, i) => (i ? [v[(i - 1) * D], v[(i - 1) * D + 1], v[(i - 1) * D + 2], withScale ? v[(i - 1) * D + 3] : 0] : [POSES[0][0], POSES[0][1], POSES[0][2], 0])
  // Initial guess: chain the measurements from submap 0.
  let cur = get(x, 0)
  for (let i = 1; i < N; i++) {
    const e = w.edges[i - 1]
    const sc = withScale ? Math.exp(cur[3]) : 1
    const d = rot(cur[2], e.d[0] * sc, e.d[1] * sc)
    cur = [cur[0] + d[0], cur[1] + d[1], cur[2] + e.th, withScale ? cur[3] + e.l : 0]
    for (let k = 0; k < D; k++) x[(i - 1) * D + k] = cur[k]
  }
  gaussNewton(
    x,
    (v) => {
      const out = []
      for (const e of w.edges) {
        const a = get(v, e.i)
        const b = get(v, e.j)
        const d = rot(-a[2], b[0] - a[0], b[1] - a[1])
        const sc = Math.exp(a[3])
        out.push((d[0] / sc - e.d[0]) / S_T, (d[1] / sc - e.d[1]) / S_T, wrap(b[2] - a[2] - e.th) / S_R)
        if (withScale) out.push((b[3] - a[3] - e.l) / S_L)
      }
      return out
    },
    30,
  )
  return POSES.map((_, i) => {
    const p = get(x, i)
    return [p[0], p[1], p[2], Math.exp(p[3])]
  })
}

// Every submap's landmarks, placed in the world with its estimated pose and scale.
export function place(w, est) {
  const out = []
  w.local.forEach((pts, i) => {
    const [x, y, th, sc] = est[i]
    for (const [k, px, py] of pts) {
      const q = rot(th, px * sc, py * sc)
      out.push([k, x + q[0], y + q[1]])
    }
  })
  return out
}

export function mapError(w, est) {
  const pts = place(w, est)
  return Math.sqrt(pts.reduce((a, [k, x, y]) => a + (x - MARKS[k][0]) ** 2 + (y - MARKS[k][1]) ** 2, 0) / pts.length)
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.6, target: [0, 0.2, 0], az: 0, el: 56, grid: 20 })
  const marks = MARKS.map((m) => {
    const b = ball(C.truth, 0.09, 0.45)
    b.position.set(m[0], 0.09, m[1])
    return b
  })
  const dots = Array.from({ length: 200 }, () => ball(C.est, 0.07))
  const loop = new Ribbon(N + 1, C.est, 0.07)
  const real = new Ribbon(N + 1, C.truth, 0.04, 0.35)
  real.set([...POSES, POSES[0]].map((p) => [p[0], p[1]]), 0.02)
  const bot = rover(C.est)
  stage.scene.add(...marks, ...dots, loop.mesh, real.mesh, bot)
  stage.label('landmark, true position').pos.set(MARKS[5][0], 0.3, MARKS[5][1])

  const mode = fig.choice([['rigid', 'align submaps rigidly'], ['sim', 'also solve for each scale']], 'rigid')
  const spread = fig.slider('difference in scale between submaps', { min: 0, max: 30, step: 1, value: 15, fmt: (v) => v + '%' })
  let seed = 1
  let est, err, t = 0
  function build2() {
    const w = build(spread.value / 100, seed)
    est = solve(w, mode.value === 'sim')
    err = mapError(w, est)
    const pts = place(w, est)
    dots.forEach((d, i) => {
      d.visible = i < pts.length
      if (d.visible) d.position.set(pts[i][1], 0.1, pts[i][2])
    })
    loop.set([...est, est[0]].map((p) => [p[0], p[1]]), 0.03)
  }
  mode.on = spread.on = build2
  fig.button('new scales', () => {
    seed++
    build2()
  })
  build2()

  stage.update = (dt) => {
    t = (t + dt * 1.2) % N
    const i = Math.floor(t)
    const a = est[i]
    const b = est[(i + 1) % N]
    const f = t - i
    bot.setPose(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + wrap(b[2] - a[2]) * f)
    fig.readout(`average error of the landmarks in the map: <b class="est">${(err * 100).toFixed(0)} cm</b>`)
  }
}
