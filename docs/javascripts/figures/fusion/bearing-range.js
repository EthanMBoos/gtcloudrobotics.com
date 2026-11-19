// What one measurement says about where the robot is. The surface is the
// likelihood of each ground position given the enabled measurements.

import { C, at, THREE, rover, post, Surface, Segs, wrap, deg } from '../lib.js'

const LM = [[-1.6, 0.9], [3.3, 0.6]]
const B = [-6.5, 6.5, -5, 5]
const N = 84

export default function mount(fig) {
  const stage = fig.stage({ width: 6.2, target: [0, 0.3, 0], az: 0, el: 46, grid: 16 })
  const robot = rover()
  const posts = LM.map(([x, y]) => at(post(C.truth, 1.0), x, y))
  const surf = new Surface(N, B, C.est, 0.85)
  const rays = new Segs(2, C.meas, 0.7)
  stage.scene.add(robot, ...posts, surf.mesh, rays.mesh)
  const labels = LM.map(([x, y]) => {
    const L = stage.label('landmark')
    L.pos.set(x, 1.25, y)
    return L
  })

  const useR = fig.toggle('range', true)
  const useB = fig.toggle('bearing', false)
  const two = fig.toggle('second landmark', false)
  const sr = fig.slider('range noise', { min: 0.05, max: 0.8, step: 0.01, value: 0.25, fmt: (v) => v.toFixed(2) + ' m' })
  const sb = fig.slider('bearing noise', { min: 1, max: 15, step: 0.5, value: 5, fmt: (v) => v.toFixed(1) + '°' })
  const cell = ((B[1] - B[0]) / (N - 1)) * ((B[3] - B[2]) / (N - 1))

  stage.update = (dt, t) => {
    const p = [1.2 * Math.cos(0.21 * t) + 0.4, -1.8 + 1.1 * Math.sin(0.33 * t)]
    robot.setPose(p[0], p[1], 0.21 * t + Math.PI / 2)
    const n = two.value ? 2 : 1
    posts[1].visible = labels[1].show = two.value
    const m = LM.slice(0, n).map(([lx, ly]) => ({
      lx,
      ly,
      r: Math.hypot(p[0] - lx, p[1] - ly),
      b: Math.atan2(p[1] - ly, p[0] - lx),
    }))
    const ir = 1 / sr.value
    const ib = 1 / (sb.value * deg)
    const on = useR.value || useB.value
    let area = 0
    surf.update((x, y) => {
      if (!on) return 0
      let e = 0
      for (const q of m) {
        const dx = x - q.lx
        const dy = y - q.ly
        if (useR.value) e += ((Math.hypot(dx, dy) - q.r) * ir) ** 2
        if (useB.value) e += (wrap(Math.atan2(dy, dx) - q.b) * ib) ** 2
      }
      const L = Math.exp(-0.5 * e)
      if (L > 0.6) area += cell
      return L * 0.9
    }, 0.9)
    rays.begin()
    for (const q of m) rays.add(q.lx, 1.0, q.ly, p[0], 0.4, p[1])
    rays.end()
    fig.readout(on ? `positions that fit the measurements: about <b>${area.toFixed(1)} m²</b>` : 'no measurements, so anywhere fits')
  }
}
