// A planar quadrotor moving sideways. The position loop asks for a tilt and
// the attitude loop delivers it, so the inner loop has to be the faster one.

import { C, THREE, drone, ball, Arrow, Segs, deg } from '../lib.js'
import { G, H, Planar } from './sim.js'
import { trace } from './common.js'

const ALT = 2.2
const HALF = 2

export default function mount(fig) {
  const stage = fig.stage({ width: 5.2, target: [0, 1.9, 0], az: 0, el: 6, grid: 12 })
  const craft = drone(C.truth, 1, 1.5)
  const goal = ball(C.goal, 0.14)
  const thrust = new Arrow(C.truth, 0.04)
  const want = new Arrow(C.goal, 0.028, 0.8)
  const path = trace(500, C.truth, 0.05, 0.55)
  const level = new Segs(1, C.goal, 0.7)
  level.begin()
  level.add(-6, ALT, 0, 6, ALT, 0)
  level.end()
  stage.scene.add(craft, goal, thrust.group, want.group, path.mesh, level.mesh)
  const lWant = stage.label('tilt asked for', 'goal')

  const ratio = fig.slider('attitude loop speed', { min: 0.5, max: 8, step: 0.25, value: 4, fmt: (v) => v.toFixed(2) + ' × position loop' })
  const tilt = fig.slider('tilt limit', { min: 10, max: 60, step: 1, value: 45, fmt: (v) => v.toFixed(0) + '°' })
  const comp = fig.toggle('more thrust when tilted', true)

  const sim = new Planar()
  let pts = []
  let acc = 0
  let since = 4.5
  let side = -1
  let k = 0
  function restart() {
    sim.reset(-HALF, ALT)
    side = -1
    since = 4.5
    pts = []
  }
  restart()
  fig.button('restart', restart)

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  stage.update = (dt) => {
    Object.assign(sim.o, { ratio: ratio.value, tiltMax: tilt.value, compensate: comp.value })
    acc += dt
    while (acc > H) {
      acc -= H
      since += H
      if (since > 6) {
        since = 0
        side = -side
      }
      sim.xr = side * HALF
      sim.zr = ALT
      sim.step()
      if (k++ % 4 === 0) {
        pts.push([sim.x, sim.z])
        if (pts.length > 500) pts.shift()
      }
      if (Math.abs(sim.x) > 7) restart()
    }
    craft.position.set(sim.x, sim.z, 0)
    craft.rotation.z = -sim.th
    goal.position.set(sim.xr, ALT, 0)
    path.set(pts, -0.05)
    a.set(sim.x, sim.z, 0)
    const len = (sim.T / G) * 1.3
    thrust.set(a, b.set(sim.x + len * Math.sin(sim.th), sim.z + len * Math.cos(sim.th), 0))
    want.set(a, b.set(sim.x + 1.9 * Math.sin(sim.thCmd), sim.z + 1.9 * Math.cos(sim.thCmd), 0.02))
    lWant.pos.copy(b)
    fig.readout(
      `position error <b class="meas">${(sim.xr - sim.x).toFixed(2)} m</b> → tilt asked for <b class="goal">${(sim.thCmd / deg).toFixed(0)}°</b> → ` +
        `tilt <b>${(sim.th / deg).toFixed(0)}°</b> · altitude error <b>${(sim.zr - sim.z).toFixed(2)} m</b>`,
    )
  }
}
