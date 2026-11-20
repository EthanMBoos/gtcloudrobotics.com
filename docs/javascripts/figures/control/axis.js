// Shared scene for the horizontal-axis figures: one or two drones moving
// left and right between two targets. Time runs into the screen, so the path
// already flown recedes behind each drone.

import { C, drone, shadow, ball, Ribbon, lerp } from '../lib.js'
import { G } from './sim.js'

export const STEP = 0.05 // controller period, s
const YV = 1.4
const TS = 0.9 // scene units per second
const ALT = 0.9

// o.vehicles: [{ ax, color, ctrl(err, v, ax) -> input }]. o.dist(): meters
// between the targets. o.scale(): scene units per meter.
export function axisFig(fig, o) {
  const stage = fig.stage({ width: 6.2, target: [0, 0.3, -0.4], az: 0, el: 36, grid: 28 })
  const period = o.period || 8
  const goal = ball(C.goal, 0.16)
  const tGoal = new Ribbon(500, C.goal, 0.05, 0.8)
  stage.scene.add(goal, tGoal.mesh)
  const lGoal = stage.label('target', 'goal')
  const vs = o.vehicles.map((v, i) => {
    const craft = drone(v.color, i ? 0.7 : 1, 1.1)
    const shade = shadow(0.36)
    const trail = new Ribbon(500, v.color, 0.07, i ? 0.85 : 1)
    stage.scene.add(craft, shade, trail.mesh)
    const tag = v.label ? stage.label(v.label, v.cls || '') : null
    if (tag) tag.dy = i ? 58 : 0 // the second label goes below its drone
    return { ...v, craft, shade, trail, tag, prev: 0, peak: 0 }
  })

  let hist = []
  let acc = 0
  let since = 0
  let side = -1
  let t = 0
  let scale = o.scale()
  let dist = o.dist()

  function restart() {
    scale = o.scale()
    dist = o.dist()
    side = -1
    since = period - 1
    t = 0
    hist = []
    for (const v of vs) {
      v.ax.reset((side * dist) / 2)
      v.prev = v.ax.p
      v.peak = 0
    }
    if (o.restart) o.restart()
  }
  restart()

  const api = { stage, restart, YV, TS, ALT, vs, target: () => (side * dist) / 2, scale: () => scale }

  stage.update = (dt) => {
    if (o.apply) o.apply()
    if (o.scale() !== scale || o.dist() !== dist) restart()
    acc += dt
    while (acc > STEP) {
      acc -= STEP
      since += STEP
      t += STEP
      if (since > period) {
        since = 0
        side = -side
        for (const v of vs) v.peak = 0
      }
      const target = api.target()
      for (const v of vs) {
        v.prev = v.ax.p
        v.ax.step(v.ctrl(v.ax.p - target, v.ax.v, v.ax), STEP)
        v.peak = Math.max(v.peak, side * (v.ax.p - target))
        if (Math.abs(v.ax.p) > dist * 4 + 20) restart()
      }
      hist.push([t, target, ...vs.map((v) => v.ax.p)])
      if (hist.length > 500) hist.shift()
      if (o.after) o.after(api)
    }
    const a = acc / STEP
    const now = t - STEP + a * STEP
    const Y = (p) => YV - (now - p[0]) * TS
    const recent = hist.filter((p) => now - p[0] < 9)
    tGoal.set(recent.map((p) => [p[1] * scale, Y(p)]), 0.014)
    vs.forEach((v, i) => {
      const x = lerp(v.prev, v.ax.p, a) * scale
      v.x = x
      v.trail.set([...recent.map((p) => [p[2 + i] * scale, Y(p)]), [x, YV]], 0.02 + i * 0.004)
      v.craft.position.set(x, ALT, YV)
      v.craft.rotation.z = -Math.atan2(v.ax.us || 0, G)
      v.shade.position.set(x, 0.012, YV)
      if (v.tag) v.tag.pos.set(x, ALT + 0.3, YV)
    })
    goal.position.set(api.target() * scale, ALT, YV)
    lGoal.pos.set(api.target() * scale, ALT + 0.25, YV)
    if (o.draw) o.draw(api, a)
  }
  fig.button('restart', restart)
  return api
}
