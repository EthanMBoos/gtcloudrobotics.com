// Ranking two policies with an imperfect evaluator. Each policy is rolled out
// n times in a world model, and the model's verdict on each rollout (success
// or failure) is right with a fixed probability. The policy with more judged
// successes is preferred. The chance that this is the better policy is an
// exact binomial calculation; the animation draws trials from the same model.

import { C, THREE, rng, mat } from '../lib.js'

export const PA = 0.5 // true success rate of the weaker policy

function pmf(n, q) {
  const out = new Float64Array(n + 1)
  const lq = Math.log(q)
  const l1 = Math.log(1 - q)
  let lc = 0
  for (let k = 0; k <= n; k++) {
    out[k] = Math.exp(lc + k * lq + (n - k) * l1)
    lc += Math.log((n - k) / (k + 1))
  }
  return out
}

// How often a rollout of a policy with true success rate p is judged a success.
export const judged = (p, acc) => p * acc + (1 - p) * (1 - acc)

// Probability that B is preferred when B is truly better; a tie counts half.
export function pCorrect(pA, pB, acc, n) {
  const clampq = (q) => Math.min(Math.max(q, 1e-9), 1 - 1e-9)
  const a = pmf(n, clampq(judged(pA, acc)))
  const b = pmf(n, clampq(judged(pB, acc)))
  let cdf = 0
  let s = 0
  for (let k = 0; k <= n; k++) {
    s += b[k] * (cdf + 0.5 * a[k])
    cdf += a[k]
  }
  return s
}

// One trial: judged successes of each policy.
export function trial(r, pA, pB, acc, n) {
  const draw = (p) => {
    const out = []
    for (let i = 0; i < n; i++) out.push(r() < p === r() < acc)
    return out
  }
  return [draw(pA), draw(pB)]
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.6, target: [0, 0, 0], az: 0, el: 58, grid: 0 })
  const COLS = 30
  const MAX = 300
  const geo = new THREE.SphereGeometry(0.085, 12, 8)
  const mOk = mat(C.goal)
  const mNo = mat(C.grid)
  const blocks = [-1.55, 1.55].map((y0) =>
    Array.from({ length: MAX }, (_, i) => {
      const m = new THREE.Mesh(geo, mNo)
      m.position.set(((i % COLS) - (COLS - 1) / 2) * 0.44, 0.09, y0 + (Math.floor(i / COLS) - 4.5) * 0.27)
      stage.scene.add(m)
      return m
    }),
  )
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(13.6, 0.001, 2.9)),
    new THREE.LineBasicMaterial({ color: C.est }),
  )
  stage.scene.add(frame)
  const lA = stage.label('')
  const lB = stage.label('')
  lA.pos.set(-4.2, 0, -3.05)
  lB.pos.set(-4.2, 0, 0.05)
  const lPick = stage.label('preferred by the evaluator', 'est')

  const gap = fig.slider('policy B is better by', { min: 1, max: 30, step: 1, value: 15, fmt: (v) => v + ' points' })
  const acc = fig.slider('evaluator accuracy', { min: 50, max: 100, step: 1, value: 70, fmt: (v) => v + '%' })
  const n = fig.slider('rollouts per policy', { min: 10, max: MAX, step: 10, value: 60, fmt: (v) => v })
  const chart = fig.chart({ xlabel: 'rollouts per policy', ylabel: 'chance of the correct ranking', color: C.est })

  const r = rng(11)
  let right, trials, timer
  function build() {
    right = trials = 0
    timer = 0
    const pB = PA + gap.value / 100
    const pts = []
    for (let k = 10; k <= MAX; k += 10) pts.push([k, pCorrect(PA, pB, acc.value / 100, k) - 0.5])
    chart.set(pts, n.value, 0.5)
    lA.el.textContent = `policy A: succeeds ${Math.round(PA * 100)}% of the time`
    lB.el.textContent = `policy B: succeeds ${Math.round(pB * 100)}% of the time`
  }
  gap.on = acc.on = n.on = build
  build()

  stage.update = (dt) => {
    timer -= dt
    if (timer <= 0) {
      timer = 0.9
      const pB = PA + gap.value / 100
      const res = trial(r, PA, pB, acc.value / 100, n.value)
      const sum = res.map((a) => a.filter(Boolean).length)
      blocks.forEach((b, k) =>
        b.forEach((m, i) => {
          m.visible = i < n.value
          if (m.visible) m.material = res[k][i] ? mOk : mNo
        }),
      )
      trials++
      right += sum[1] > sum[0] ? 1 : sum[1] === sum[0] ? 0.5 : 0
      const pick = sum[1] >= sum[0] ? 1 : 0
      frame.visible = lPick.show = sum[1] !== sum[0]
      const rows = Math.ceil(n.value / COLS)
      frame.scale.z = (rows * 0.27 + 0.2) / 2.9
      frame.position.set(0, 0.02, (pick ? 1.55 : -1.55) - 1.215 + (rows - 1) * 0.135)
      lPick.pos.set(4.4, 0, pick ? 0.05 : -3.05)
    }
    const exact = pCorrect(PA, PA + gap.value / 100, acc.value / 100, n.value)
    fig.readout(
      `chance of ranking the two correctly: <b class="est">${(exact * 100).toFixed(0)}%</b> · in the ${trials} trials drawn so far: <b>${((right / trials) * 100).toFixed(0)}%</b>`,
    )
  }
}
