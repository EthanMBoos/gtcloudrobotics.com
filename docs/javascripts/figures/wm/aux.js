// Prediction as a training signal. Each observation has D numbers, of which
// only a two-dimensional state matters; the rest change at random. The expert
// action is a linear function of that state. A policy fitted by least squares
// to a few labeled demonstrations must find the state among all D numbers.
// Unlabeled video can find it first: the directions of an observation that
// predict the next observation are the state, because the random part
// predicts nothing. This is reduced-rank regression, in closed form.

import { C, rng, ball, Ribbon, Segs } from '../lib.js'
import { solve } from '../fusion/lsq.js'

export const D = 12
const RANK = 2
const RIDGE = 0.05

function world(seed) {
  const r = rng(seed)
  // A random mixing matrix, so the state is not aligned with any coordinate.
  const M = Array.from({ length: D * D }, () => r.n() / Math.sqrt(D))
  const w = [r.n(), r.n()]
  const c = Math.cos(0.35)
  const s = Math.sin(0.35)
  let st = [r.n(), r.n()]
  const next = () => {
    st = [0.95 * (c * st[0] - s * st[1]) + 0.3 * r.n(), 0.95 * (s * st[0] + c * st[1]) + 0.3 * r.n()]
    const z = [st[0], st[1], ...Array.from({ length: D - 2 }, () => r.n())]
    const o = new Float64Array(D)
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) o[i] += M[i * D + j] * z[j]
    return { o, a: w[0] * st[0] + w[1] * st[1] }
  }
  return { r, next }
}

// Ridge regression of scalar targets y on rows X (each of length d).
function ridge(X, y, d) {
  const A = new Float64Array(d * d)
  const b = new Float64Array(d)
  X.forEach((x, k) => {
    for (let i = 0; i < d; i++) {
      b[i] += x[i] * y[k]
      for (let j = 0; j < d; j++) A[i * d + j] += x[i] * x[j]
    }
  })
  for (let i = 0; i < d; i++) A[i * d + i] += RIDGE
  return solve(A, b)
}

// The RANK directions of an observation that best predict the next one.
function predictive(frames) {
  const X = frames.slice(0, -1)
  const B = [] // B[j]: weights predicting coordinate j of the next frame
  for (let j = 0; j < D; j++) B.push(ridge(X, frames.slice(1).map((f) => f[j]), D))
  const fit = X.map((x) => B.map((bj) => bj.reduce((s, v, i) => s + v * x[i], 0)))
  const S = new Float64Array(D * D)
  for (const f of fit) for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) S[i * D + j] += f[i] * f[j]
  const V = []
  for (let k = 0; k < RANK; k++) {
    let v = Float64Array.from({ length: D }, (_, i) => Math.sin(i + 1 + k))
    for (let it = 0; it < 200; it++) {
      const u = new Float64Array(D)
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) u[i] += S[i * D + j] * v[j]
      for (const p of V) {
        const dot = u.reduce((s, x, i) => s + x * p[i], 0)
        for (let i = 0; i < D; i++) u[i] -= dot * p[i]
      }
      const n = Math.hypot(...u)
      v = u.map((x) => x / n)
    }
    V.push(v)
  }
  // Feature k of an observation: its predicted next frame, along direction k.
  return (o) => V.map((v) => B.reduce((s, bj, j) => s + v[j] * bj.reduce((t, c, i) => t + c * o[i], 0), 0))
}

// Action error on held-out data, as a fraction of the spread of the actions,
// for each number of labeled demonstrations in `labels`.
export function errors(video, labels, seed) {
  const W = world(seed)
  const frames = Array.from({ length: video }, () => W.next().o)
  const feat = video > D + 2 ? predictive(frames) : null
  const train = Array.from({ length: Math.max(...labels) }, () => W.next())
  const test = Array.from({ length: 300 }, () => W.next())
  const spread = Math.sqrt(test.reduce((s, t) => s + t.a * t.a, 0) / test.length)
  const score = (f, d, n) => {
    const w = ridge(train.slice(0, n).map((t) => f(t.o)), train.slice(0, n).map((t) => t.a), d)
    let e = 0
    for (const t of test) e += (f(t.o).reduce((s, x, i) => s + x * w[i], 0) - t.a) ** 2
    return Math.sqrt(e / test.length) / spread
  }
  return labels.map((n) => {
    const plain = score((o) => o, D, n)
    return [plain, feat ? score(feat, RANK, n) : plain]
  })
}

export const LABELS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40]

// Mean over seeds of errors(), as [plain, withPrediction] per entry of LABELS.
export function curves(video, seeds = 12) {
  const sum = LABELS.map(() => [0, 0])
  for (let s = 1; s <= seeds; s++) errors(video, LABELS, s).forEach((e, i) => ((sum[i][0] += e[0]), (sum[i][1] += e[1])))
  return sum.map((e) => [e[0] / seeds, e[1] / seeds])
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.2, target: [0, 2, 0], az: 0, el: 12, grid: 14 })
  const X = (n) => -5.6 + (Math.log(n) / Math.log(40)) * 11.2
  const Hh = (e) => 0.2 + 3.4 * Math.min(e, 1.15)
  const rPlain = new Ribbon(LABELS.length, C.brass, 0.5)
  const rPred = new Ribbon(LABELS.length, C.est, 0.5)
  const mPlain = ball(C.brass, 0.18)
  const mPred = ball(C.est, 0.18)
  const gap = new Segs(1, C.muted)
  stage.scene.add(rPlain.mesh, rPred.mesh, mPlain, mPred, gap.mesh)
  const lPlain = stage.label('trained on the demonstrations only', 'brass')
  const lPred = stage.label('also trained to predict video', 'est')
  stage.tag('labeled demonstrations →', 0.38, 0.93)
  stage.tag('action error', 0.02, 0.08)

  const n = fig.slider('labeled demonstrations', { min: 0, max: LABELS.length - 1, step: 1, value: 4, fmt: (v) => LABELS[v] })
  const video = fig.slider('unlabeled video', { min: 0, max: 2000, step: 100, value: 1000, fmt: (v) => v + ' frames' })

  let cur
  function build() {
    cur = curves(video.value)
    rPlain.set(cur.map((e, i) => [X(LABELS[i]), 0, Hh(e[0])]))
    rPred.set(cur.map((e, i) => [X(LABELS[i]), 0, Hh(e[1]) + 0.01]))
  }
  video.on = build
  build()

  stage.update = () => {
    const e = cur[n.value]
    const x = X(LABELS[n.value])
    mPlain.position.set(x, Hh(e[0]), 0)
    mPred.position.set(x, Hh(e[1]), 0)
    gap.begin()
    gap.add(x, Hh(e[0]), 0, x, Hh(e[1]), 0)
    gap.end()
    lPlain.pos.set(Math.min(x, 2.6), Hh(e[0]) + 0.15, 0)
    lPred.pos.set(Math.min(x, 3), Hh(e[1]), 0)
    lPred.dy = 44
    fig.readout(
      `action error with ${LABELS[n.value]} demonstrations · demonstrations only: <b class="brass">${(e[0] * 100).toFixed(0)}%</b> · with video prediction: <b class="est">${(e[1] * 100).toFixed(0)}%</b>`,
    )
  }
}
