// Open-loop rollout: feed the model its own predictions and the error
// compounds. Re-anchoring on a real observation resets it.

import { C, drone, shadow, Ribbon, Segs } from '../lib.js'
import { ALT, DT, trueStep, modelStep, dist } from './world.js'

const T = 6
const N = Math.round(T / DT)
const action = (t) => [0.42 + 0.2 * Math.cos(0.8 * t), 0.7 * Math.sin(1.1 * t)]

export default function mount(fig) {
  const stage = fig.stage({ width: 6.3, target: [-0.7, 0.9, 0], az: 0, el: 36, grid: 18 })
  const real = drone(C.truth, 1, 1.2)
  const ghost = drone(C.est, 0.8, 1.2)
  const shade = shadow(0.4)
  const rTrue = new Ribbon(N + 1, C.truth, 0.07)
  const rModel = new Ribbon(N + 1, C.est, 0.07)
  const gaps = new Segs(N, C.meas)
  stage.scene.add(real, ghost, shade, rTrue.mesh, rModel.mesh, gaps.mesh)
  const lT = stage.label('what happened')
  const lM = stage.label('what the model predicted', 'est')

  const horizon = fig.slider('horizon', { min: 0.5, max: T, step: 0.1, value: 5, fmt: (v) => v.toFixed(1) + ' s' })
  const eps = fig.slider('model error', { min: 0, max: 0.6, step: 0.02, value: 0.2, fmt: (v) => Math.round(v * 100) + '%' })
  const anchor = fig.choice([[0, 'never re-anchor'], [2, 'every 2 s'], [0.5, 'every 0.5 s']], 0)
  const chart = fig.chart({ ylabel: 'prediction error', xlabel: 'time ahead →' })

  let truth = []
  let model = []
  let err = []
  function build() {
    let s = [-6, -0.6, 0, 0]
    let m = s
    truth = [s]
    model = [m]
    err = [[0, 0]]
    const every = anchor.value ? Math.round(anchor.value / DT) : Infinity
    for (let k = 1; k <= N; k++) {
      const a = action((k - 1) * DT)
      m = modelStep(k % every === 1 || every === 1 ? truth[k - 1] : m, a, { cov: 1 - eps.value / 0.6, eps: eps.value })
      s = trueStep(s, a)
      truth.push(s)
      model.push(m)
      err.push([k * DT, dist(s, m)])
    }
  }
  eps.on = anchor.on = build
  build()

  let tau = 0
  stage.update = (dt) => {
    const n = Math.round(horizon.value / DT)
    tau = (tau + dt) % (horizon.value + 0.8)
    const k = Math.min(Math.floor(tau / DT), n)
    rTrue.set(truth.slice(0, n + 1), ALT)
    rModel.set(model.slice(0, n + 1), ALT + 0.01)
    gaps.begin()
    for (let i = 5; i <= n; i += 5) gaps.add(truth[i][0], ALT, truth[i][1], model[i][0], ALT, model[i][1])
    gaps.end()
    real.position.set(truth[k][0], ALT, truth[k][1])
    ghost.position.set(model[k][0], ALT, model[k][1])
    shade.position.set(truth[k][0], 0.012, truth[k][1])
    lM.pos.set(model[n][0], ALT + 0.2, model[n][1])
    lM.dy = 46
    lT.pos.set(truth[n][0], ALT + 0.2, truth[n][1])
    chart.set(err.slice(0, n + 1), k * DT, Math.max(1.2, ...err.map((e) => e[1])) * 1.05)
    fig.readout(`after <b>${horizon.value.toFixed(1)} s</b> the prediction is <b class="meas">${err[n][1].toFixed(2)} m</b> from where the drone ended up`)
  }
}
