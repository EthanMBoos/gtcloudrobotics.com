// The model has only learned the wind where its training flights went. The
// red surface is how wrong its one-step prediction is at each position.

import { C, rng, drone, shadow, Ribbon, Segs, Surface, clamp } from '../lib.js'
import { ALT, DT, wind, trueStep, modelStep, dist } from './world.js'

const B = [-7, 7, -4.8, 4.8]
const N = 64
const STEPS = 40 // 4 s

function fly(start, act) {
  let s = start
  const out = [s]
  for (let k = 0; k < STEPS; k++) out.push((s = trueStep(s, act(k * DT))))
  return out
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.4, target: [0, 0.5, 0], az: 0, el: 44, grid: 18 })
  const r = rng(31)
  const training = Array.from({ length: 5 }, () => {
    const p = [r() * 6, r() * 6, 0.6 + r() * 0.6, 0.8 + r() * 0.8]
    return fly([-5.4 + r() * 0.8, -3 + r() * 1.2, 0, 0], (t) => [0.34 + 0.16 * Math.cos(p[2] * t + p[0]), 0.08 + 0.26 * Math.sin(p[3] * t + p[1])])
  })
  const testAct = (t) => [0.36 + 0.12 * Math.cos(0.9 * t), 0.24 * Math.sin(1.2 * t + 1)]

  for (const f of training) {
    const rb = new Ribbon(STEPS + 1, C.brass, 0.05)
    rb.set(f, 0.03)
    stage.scene.add(rb.mesh)
  }
  const surf = new Surface(N, B, C.meas, 0.42)
  const real = drone(C.truth, 1, 1.2)
  const ghost = drone(C.est, 0.8, 1.2)
  const shade = shadow(0.4)
  const rTrue = new Ribbon(STEPS + 1, C.truth, 0.07)
  const rModel = new Ribbon(STEPS + 1, C.est, 0.07)
  const gaps = new Segs(STEPS, C.meas)
  stage.scene.add(surf.mesh, real, ghost, shade, rTrue.mesh, rModel.mesh, gaps.mesh)
  stage.label('training flights', 'brass').pos.set(-5, 0.3, -3.2)
  const lTest = stage.label('test flight')

  const off = fig.slider('distance from the training flights', { min: 0, max: 5.6, step: 0.1, value: 3.6, fmt: (v) => v.toFixed(1) + ' m' })
  const add = fig.toggle('train on this flight too', false)

  const grid = new Float32Array(N * N)
  const gx = (i) => B[0] + ((B[1] - B[0]) * i) / (N - 1)
  const gy = (j) => B[2] + ((B[3] - B[2]) * j) / (N - 1)
  const cov = (x, y) => {
    const i = clamp(Math.round(((x - B[0]) / (B[1] - B[0])) * (N - 1)), 0, N - 1)
    const j = clamp(Math.round(((y - B[2]) / (B[3] - B[2])) * (N - 1)), 0, N - 1)
    return grid[j * N + i]
  }

  let truth = []
  let model = []
  function build() {
    truth = fly([-5.2, -2.6 + off.value, 0, 0], testAct)
    const data = [...training, ...(add.value ? [truth] : [])].flatMap((f) => f.filter((_, k) => k % 2 === 0))
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let d = 0
        for (const p of data) d += Math.exp(-((gx(i) - p[0]) ** 2 + (gy(j) - p[1]) ** 2) / 1.1)
        grid[j * N + i] = 1 - Math.exp(-0.9 * d)
      }
    }
    surf.update((x, y) => {
      const w = wind(x, y)
      return (1 - cov(x, y)) * Math.hypot(w[0], w[1]) * 0.3
    }, 0.36)
    let m = truth[0]
    model = [m]
    for (let k = 0; k < STEPS; k++) model.push((m = modelStep(m, testAct(k * DT), { cov, eps: 0.03 })))
    rTrue.set(truth, ALT)
    rModel.set(model, ALT + 0.01)
    gaps.begin()
    for (let i = 5; i <= STEPS; i += 5) gaps.add(truth[i][0], ALT, truth[i][1], model[i][0], ALT, model[i][1])
    gaps.end()
  }
  off.on = () => {
    add.set(false)
    build()
  }
  add.on = build
  build()

  let tau = 0
  stage.update = (dt) => {
    tau = (tau + dt) % (STEPS * DT + 0.8)
    const k = Math.min(Math.floor(tau / DT), STEPS)
    real.position.set(truth[k][0], ALT, truth[k][1])
    ghost.position.set(model[k][0], ALT, model[k][1])
    shade.position.set(truth[k][0], 0.012, truth[k][1])
    lTest.pos.set(truth[0][0], ALT + 0.3, truth[0][1])
    fig.readout(`4 s ahead, the prediction is <b class="meas">${dist(truth[STEPS], model[STEPS]).toFixed(2)} m</b> off`)
  }
}
