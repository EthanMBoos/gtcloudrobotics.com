// A position fix that arrives late. Treated as "now", it drags the estimate
// back by speed x latency. Carried forward by odometry first, it doesn't.

import { C, rng, rover, ball, Ribbon, Segs } from '../lib.js'

const R = 3.6
const GAIN = 0.35

export default function mount(fig) {
  const stage = fig.stage({ width: 4.8, target: [0, 0.3, 0], az: 0, el: 44, grid: 14 })
  const ring = new Ribbon(130, C.muted, 0.05, 0.45)
  ring.set(Array.from({ length: 129 }, (_, i) => [R * Math.cos((i / 128) * 2 * Math.PI), R * Math.sin((i / 128) * 2 * Math.PI)]), 0.015)
  const truth = rover(C.truth)
  const est = rover(C.est, 0.9)
  const fix = ball(C.meas, 0.13)
  const link = new Segs(1, C.meas, 0.8)
  const trail = new Ribbon(300, C.est, 0.06)
  stage.scene.add(ring.mesh, truth, est, fix, link.mesh, trail.mesh)
  const lFix = stage.label('fix, as it arrives', 'meas')
  const lEst = stage.label('estimate', 'est')

  const speed = fig.slider('speed', { min: 0.5, max: 5, step: 0.1, value: 3, fmt: (v) => v.toFixed(1) + ' m/s' })
  const lat = fig.slider('latency', { min: 0, max: 400, step: 10, value: 250, fmt: (v) => v.toFixed(0) + ' ms' })
  const stamp = fig.toggle('use the timestamp', false)

  const r = rng(4)
  let phi = 0
  let t = 0
  let e = [R, 0]
  let odo = [0, 0] // integrated odometry
  let queue = []
  let nextShot = 0
  let acc = 0
  let lag = 0
  let pts = []
  let k = 0

  stage.update = (dt) => {
    acc += dt
    while (acc > 1 / 120) {
      const h = 1 / 120
      acc -= h
      t += h
      const v = speed.value
      const vel = [-v * Math.sin(phi), v * Math.cos(phi)]
      phi += (v / R) * h
      e[0] += vel[0] * h
      e[1] += vel[1] * h
      odo[0] += vel[0] * h
      odo[1] += vel[1] * h
      const p = [R * Math.cos(phi), R * Math.sin(phi)]
      if (t >= nextShot) {
        nextShot = t + 0.1
        queue.push({ due: t + lat.value / 1000, z: [p[0] + 0.04 * r.n(), p[1] + 0.04 * r.n()], odo: [...odo] })
      }
      while (queue.length && queue[0].due <= t) {
        const m = queue.shift()
        fix.position.set(m.z[0], 0.13, m.z[1])
        // With the timestamp, move the fix by how far odometry says we went since.
        const z = stamp.value ? [m.z[0] + odo[0] - m.odo[0], m.z[1] + odo[1] - m.odo[1]] : m.z
        e[0] += GAIN * (z[0] - e[0])
        e[1] += GAIN * (z[1] - e[1])
      }
      lag += (Math.hypot(e[0] - p[0], e[1] - p[1]) - lag) * 0.01
      if (k++ % 4 === 0) {
        pts.push([e[0], e[1]])
        if (pts.length > 300) pts.shift()
      }
    }
    const p = [R * Math.cos(phi), R * Math.sin(phi)]
    truth.setPose(p[0], p[1], phi + Math.PI / 2)
    est.setPose(e[0], e[1], Math.atan2(e[1], e[0]) + Math.PI / 2)
    trail.set(pts, 0.025)
    link.begin()
    link.add(fix.position.x, 0.13, fix.position.z, p[0], 0.3, p[1])
    link.end()
    lFix.pos.set(fix.position.x, 0.3, fix.position.z)
    lFix.dy = -14
    lEst.pos.set(e[0], 0.75, e[1])
    lEst.dy = 56
    fig.readout(
      `estimate is <b class="est">${lag.toFixed(2)} m</b> off · speed × latency = <b class="meas">${((speed.value * lat.value) / 1000).toFixed(2)} m</b>`,
    )
  }
}
