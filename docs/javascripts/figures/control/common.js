// Shared scene for the altitude figures: a drone that climbs and descends
// between two setpoints, with its recent altitude drawn as a strip chart
// trailing to the left.

import { C, THREE, drone, Ribbon, Segs } from '../lib.js'
import { G, H } from './sim.js'

const X0 = 3.6 // where the drone sits
const SPAN = 8 // seconds of history shown
const SPEED = 1.05 // scene units per second

// A Ribbon stood up in the vertical plane: points are [x, height].
export function trace(max, color, width = 0.06, opacity = 1) {
  const r = new Ribbon(max, color, width, opacity)
  r.mesh.rotation.x = -Math.PI / 2
  return r
}

// o.sim: an Alt. o.ghost: an optional second Alt drawn in brass.
// o.levels(): [low, high] setpoints in meters. o.scale(): scene units per
// meter. o.apply(): copy control values into the sims, once per frame.
// o.after(sim): called after every control step.
export function altFig(fig, o) {
  const stage = fig.stage({ width: 5.6, target: [-0.3, 2.4, 0], az: 0, el: 6, grid: 12 })
  const { sim, ghost } = o
  const period = o.period || 6
  const craft = drone(C.truth, 1, 1.15)
  const tZ = trace(700, C.truth, 0.07)
  const tRef = trace(700, C.goal, 0.05, 0.85)
  const err = new Segs(1, C.meas)
  stage.scene.add(craft, tZ.mesh, tRef.mesh, err.mesh)
  const lRef = stage.label('setpoint', 'goal')
  let gCraft
  let tG
  if (ghost) {
    gCraft = drone(C.brass, 0.7, 1.15)
    tG = trace(700, C.brass, 0.05, 0.9)
    stage.scene.add(gCraft, tG.mesh)
  }

  let hist = []
  let acc = 0
  let k = 0
  let up = false
  let since = 0
  let scale = o.scale()

  function restart() {
    const [lo] = o.levels()
    for (const s of [sim, ghost]) if (s) s.reset(lo, lo)
    hist = []
    up = false
    since = period - 1.5
    scale = o.scale()
    if (o.restart) o.restart()
  }
  restart()

  stage.update = (dt) => {
    o.apply()
    if (o.scale() !== scale) restart()
    acc += dt
    while (acc > H) {
      acc -= H
      since += H
      if (since > period) {
        since = 0
        up = !up
        if (o.flip) o.flip(up)
      }
      const ref = o.levels()[up ? 1 : 0]
      for (const s of [sim, ghost]) {
        if (!s) continue
        s.ref = ref
        s.step()
      }
      if (o.after) o.after(sim)
      if (k++ % 4 === 0) {
        hist.push([sim.t, sim.z, ref, ghost ? ghost.z : 0, sim.u, sim.motor.f])
        if (hist.length > 700) hist.shift()
      }
      if (sim.z * scale > 7.5 || (ghost && ghost.z * scale > 7.5)) restart()
    }
    const now = sim.t
    const from = hist.findIndex((p) => now - p[0] < SPAN)
    const recent = from < 0 ? [] : hist.slice(from)
    const X = (p) => X0 - (now - p[0]) * SPEED
    tZ.set(recent.map((p) => [X(p), p[1] * scale]), 0)
    tRef.set(recent.map((p) => [X(p), p[2] * scale]), 0.02)
    if (ghost) {
      tG.set(recent.map((p) => [X(p), p[3] * scale]), 0.01)
      gCraft.position.set(X0 + 1.1, ghost.z * scale, 0)
    }
    craft.position.set(X0, sim.z * scale, 0)
    err.begin()
    err.add(X0 + 0.55, sim.z * scale, 0, X0 + 0.55, sim.ref * scale, 0)
    err.end()
    lRef.pos.set(X0 - 1.2, sim.ref * scale + 0.1, 0)
    if (o.draw) o.draw(recent, now)
  }
  fig.button('restart', restart)
  return { stage, restart, X0 }
}

// Rolling chart of the thrust command (red) and the thrust delivered (dark).
export function thrustChart(fig, max = 2 * G) {
  const chart = fig.chart({ ylabel: 'thrust: commanded (red), delivered (dark), limit (dashed)', xlabel: 'time →' })
  return (recent) => {
    if (recent.length < 2) return
    chart.set(
      recent.map((p) => [p[0], p[4]]),
      null,
      max * 1.6,
      recent.map((p) => [p[0], p[5]]),
      max,
    )
  }
}

export { THREE }
