// One state, five candidate actions, five predicted next states. Take an
// action and the real next state lands a little off the prediction.

import { C, THREE, rng, drone, ball, shadow, Ribbon, Segs, clamp } from '../lib.js'
import { ALT, DT, trueStep, modelStep, dist } from './world.js'

const HOLD = 10 // model steps per action, 1 s
const ACTIONS = [['←', [-1, 0]], ['↑', [0, -1]], ['hover', [0, 0]], ['↓', [0, 1]], ['→', [1, 0]]]
const BX = 4.2
const BY = 2.6

export default function mount(fig) {
  const stage = fig.stage({ width: 5, target: [0, 0.6, 0], az: 0, el: 36, grid: 14 })
  const craft = drone(C.truth, 1, 1.2)
  const shade = shadow(0.4)
  const ghosts = ACTIONS.map(() => ball(C.est, 0.1, 0.9))
  const fans = ACTIONS.map(() => new Ribbon(HOLD + 1, C.est, 0.05, 0.7))
  const misses = new Segs(14, C.meas)
  const trail = new Ribbon(260, C.truth, 0.04, 0.5)
  stage.scene.add(craft, shade, ...ghosts, ...fans.map((f) => f.mesh), misses.mesh, trail.mesh)
  const lab = stage.label('predicted next states', 'est')

  const auto = fig.toggle('auto', true)
  for (let i = 0; i < ACTIONS.length; i++) {
    fig.button(ACTIONS[i][0], () => {
      auto.set(false)
      take(i)
    })
  }

  const r = rng(12)
  let s = [-2, 0.5, 0, 0]
  let pred = []
  let busy = null // { a, left, target }
  let acc = 0
  let idle = 0
  let last = null
  let missList = []
  let pts = []

  function predict() {
    pred = ACTIONS.map(([, a], i) => {
      let q = s
      const line = [[q[0], q[1]]]
      for (let k = 0; k < HOLD; k++) {
        q = modelStep(q, a)
        line.push([q[0], q[1]])
      }
      fans[i].set(line, ALT)
      ghosts[i].position.set(q[0], ALT, q[1])
      return q
    })
  }

  function take(i) {
    if (busy) return
    busy = { a: ACTIONS[i][1], left: HOLD, target: pred[i] }
  }

  function autoPick() {
    // Head back toward the middle when near an edge, otherwise wander.
    if (Math.abs(s[0]) > BX - 1.5) return s[0] > 0 ? 0 : 4
    if (Math.abs(s[1]) > BY - 1.2) return s[1] > 0 ? 1 : 3
    return Math.floor(r() * ACTIONS.length)
  }

  predict()

  stage.update = (dt) => {
    if (busy) {
      acc += dt
      while (busy && acc > DT) {
        acc -= DT
        s = trueStep(s, busy.a)
        s[0] = clamp(s[0], -BX, BX)
        s[1] = clamp(s[1], -BY, BY)
        pts.push([s[0], s[1]])
        if (pts.length > 260) pts.shift()
        if (--busy.left === 0) {
          last = dist(s, busy.target)
          missList.push([busy.target[0], busy.target[1], s[0], s[1]])
          if (missList.length > 14) missList.shift()
          misses.begin()
          for (const m of missList) misses.add(m[0], ALT, m[1], m[2], ALT, m[3])
          misses.end()
          busy = null
          idle = 0
          predict()
        }
      }
    } else if (auto.value && (idle += dt) > 0.9) {
      take(autoPick())
    }
    for (const g of ghosts) g.visible = !busy
    for (const f of fans) f.mesh.visible = !busy
    lab.show = !busy
    craft.position.set(s[0], ALT, s[1])
    shade.position.set(s[0], 0.012, s[1])
    trail.set(pts, ALT)
    lab.pos.set(s[0], ALT + 0.5, s[1] - 1.6)
    fig.readout(last == null ? 'pick an action' : `last prediction, 1 s ahead, missed by <b class="meas">${last.toFixed(2)} m</b>`)
  }
}
