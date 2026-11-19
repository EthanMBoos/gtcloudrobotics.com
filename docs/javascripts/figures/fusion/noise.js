// A lidar ranging one post. Each return lands somewhere near the post; the
// pile averages out the noise but keeps the bias.

import { C, at, THREE, rng, rover, post, ball, mat, Surface, Segs, deg } from '../lib.js'

export default function mount(fig) {
  const stage = fig.stage({ width: 4.6, target: [0.2, 0.6, 0], az: 18, el: 28, grid: 16 })
  const R = [-3.4, 0]
  const T = [3.1, 0]
  const D = T[0] - R[0]

  const robot = rover()
  robot.setPose(R[0], R[1], 0)
  stage.scene.add(robot, at(post(C.truth, 1.0), T[0], T[1]))

  const sig = fig.slider('range noise', { min: 0, max: 0.6, step: 0.02, value: 0.24, fmt: (v) => v.toFixed(2) + ' m' })
  const bias = fig.slider('bias', { min: -0.8, max: 0.8, step: 0.02, value: 0, fmt: (v) => v.toFixed(2) + ' m' })
  const sb = fig.slider('bearing noise', { min: 0, max: 8, step: 0.2, value: 2.4, fmt: (v) => v.toFixed(1) + '°' })

  const MAX = 260
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), mat(C.meas), MAX)
  dots.frustumCulled = false
  const N = 60
  const B = [0.6, 5.6, -2.5, 2.5]
  const grid = new Float32Array(N * N)
  const surf = new Surface(N, B, C.meas, 0.7)
  const ray = new Segs(1, C.meas, 0.6)
  const mean = ball(C.est, 0.11)
  stage.scene.add(dots, surf.mesh, ray.mesh, mean)

  const lTrue = stage.label('true position')
  lTrue.pos.set(T[0], 1.25, T[1])
  const lMean = stage.label('mean', 'est')

  const r = rng(7)
  const m4 = new THREE.Matrix4()
  let n = 0
  let sx = 0
  let sy = 0
  let top = 1e-6
  let acc = 0

  function reset() {
    n = sx = sy = 0
    top = 1e-6
    grid.fill(0)
    dots.count = 0
  }
  sig.on = bias.on = sb.on = reset
  reset()

  function shot() {
    const range = D + bias.value + sig.value * r.n()
    const b = sb.value * deg * r.n()
    const x = R[0] + range * Math.cos(b)
    const y = R[1] + range * Math.sin(b)
    m4.makeTranslation(x, 0.05, y)
    dots.setMatrixAt(n % MAX, m4)
    dots.count = Math.min(n + 1, MAX)
    dots.instanceMatrix.needsUpdate = true
    n++
    sx += x
    sy += y
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const gx = B[0] + ((B[1] - B[0]) * i) / (N - 1)
        const gy = B[2] + ((B[3] - B[2]) * j) / (N - 1)
        const v = (grid[j * N + i] += Math.exp(-((gx - x) ** 2 + (gy - y) ** 2) / 0.045))
        if (v > top) top = v
      }
    }
    ray.begin()
    ray.add(R[0] + 0.2, 0.45, R[1], x, 0.05, y)
    ray.end()
  }

  stage.update = (dt) => {
    acc += dt
    while (acc > 0.07) {
      acc -= 0.07
      shot()
    }
    surf.update((x, y) => {
      const i = Math.round(((x - B[0]) / (B[1] - B[0])) * (N - 1))
      const j = Math.round(((y - B[2]) / (B[3] - B[2])) * (N - 1))
      return (grid[j * N + i] / top) * 1.5
    }, 1.5)
    if (!n) return
    const mx = sx / n
    const my = sy / n
    mean.position.set(mx, 0.11, my)
    lMean.pos.set(mx, 0.3, my)
    lMean.dy = 34
    fig.readout(`<b>${n}</b> returns · their mean is <b>${Math.hypot(mx - T[0], my - T[1]).toFixed(2)} m</b> from the post`)
  }
}
