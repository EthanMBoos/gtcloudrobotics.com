// The two cost weights of the MPC as trainable parameters. The surface is the
// score of a batch of flights at each pair of weights; "train" follows its
// slope downhill from the hand-tuned starting point.

import { C, ball, Surface, Ribbon, clamp } from '../lib.js'
import { flights, flightScore } from './sim.js'

const L1 = [0, 3] // log10 of the position weight
const L2 = [0, 3] // log10 of the velocity weight
const BOX = [-4.2, 4.2, -2.6, 2.6]
const N = 15
const START = [2, 1]
const TOP = 3

const X = (l1) => BOX[0] + ((l1 - L1[0]) / (L1[1] - L1[0])) * (BOX[1] - BOX[0])
const Y = (l2) => BOX[3] - ((l2 - L2[0]) / (L2[1] - L2[0])) * (BOX[3] - BOX[2])
const height = (s) => clamp(Math.log(s / 1.8) / Math.log(25), 0, 1) * TOP

export default function mount(fig) {
  const stage = fig.stage({ width: 5.6, target: [0, 1.1, 0], az: -24, el: 34, grid: 12 })
  const surf = new Surface(N, BOX, C.muted, 0.85)
  const hand = ball(C.brass, 0.15)
  const cur = ball(C.est, 0.17)
  const path = new Ribbon(200, C.est, 0.09)
  stage.scene.add(surf.mesh, hand, cur, path.mesh)
  stage.label('position weight →').pos.set(0, 0, BOX[3] + 0.5)
  stage.label('velocity weight ↗').pos.set(BOX[0] - 0.5, 0, 0.4)
  const lHand = stage.label('hand-tuned', 'brass')
  const lCur = stage.label('trained', 'est')

  const random = fig.toggle('train on gusts, lag, and delay', true)
  const gust = fig.slider('gust', { min: 0.5, max: 3, step: 0.25, value: 2, fmt: (v) => v.toFixed(2) + ' m/s²' })

  let grid = []
  let next = 0
  let batch = []
  let test = []
  let w = [...START]
  let trail = []
  let step = 0
  let training = false
  let clock = 0
  let here = null
  let base = null

  const f = (l1, l2) => flightScore(l1, l2, batch).score
  const lift = (l1, l2) => [X(l1), Y(l2), height(f(l1, l2)) + 0.06]

  function reset() {
    batch = flights(gust.value, random.value)
    test = flights(gust.value, true)
    grid = new Array(N * N).fill(null)
    next = 0
    w = [...START]
    trail = [lift(...w)]
    step = 0.2
    training = false
    here = flightScore(...w, test)
    base = here
  }
  random.on = gust.on = reset
  reset()
  fig.button('train', () => {
    training = true
    step = 0.2
  })
  fig.button('reset', reset)

  // One step downhill, with the slope estimated by finite differences.
  function descend() {
    const d = 0.08
    const g1 = f(w[0] + d, w[1]) - f(w[0] - d, w[1])
    const g2 = f(w[0], w[1] + d) - f(w[0], w[1] - d)
    const n = Math.hypot(g1, g2) || 1
    const now = f(...w)
    while (step > 0.02) {
      const t = [clamp(w[0] - (step * g1) / n, L1[0], L1[1]), clamp(w[1] - (step * g2) / n, L2[0], L2[1])]
      if (f(...t) < now - 1e-4) {
        w = t
        trail.push(lift(...w))
        here = flightScore(...w, test)
        return
      }
      step /= 2
    }
    training = false
  }

  stage.update = (dt) => {
    // Fill in the surface a few points per frame so the page never stalls.
    if (next < N * N) {
      for (let i = 0; i < 5 && next < N * N; i++, next++) {
        const l1 = L1[0] + ((next % N) / (N - 1)) * (L1[1] - L1[0])
        const l2 = L2[1] - (Math.floor(next / N) / (N - 1)) * (L2[1] - L2[0])
        grid[next] = height(f(l1, l2))
      }
      surf.update((x, y) => {
        const i = Math.round(((x - BOX[0]) / (BOX[1] - BOX[0])) * (N - 1))
        const j = Math.round(((y - BOX[2]) / (BOX[3] - BOX[2])) * (N - 1))
        return grid[j * N + i] ?? 0
      }, TOP * 0.7)
    }
    clock += dt
    if (training && clock > 0.12) {
      clock = 0
      descend()
    }
    const s = lift(...START)
    hand.position.set(s[0], s[2], s[1])
    lHand.pos.set(s[0], s[2] + 0.2, s[1])
    const c = trail[trail.length - 1]
    cur.position.set(c[0], c[2], c[1])
    lCur.pos.set(c[0], c[2] + 0.2, c[1])
    lCur.show = cur.visible = trail.length > 1
    path.set(trail.length > 1 ? trail : [c, c])
    fig.readout(
      `on the gusty flights: hand-tuned passes the wall in <b class="brass">${base.crashes} of ${test.length}</b>` +
        (trail.length > 1 ? `, trained in <b class="est">${here.crashes} of ${test.length}</b>` : '') +
        ` · weights <b>${(10 ** w[0]).toPrecision(2) * 1}</b> and <b>${(10 ** w[1]).toPrecision(2) * 1}</b> × effort`,
    )
  }
}
