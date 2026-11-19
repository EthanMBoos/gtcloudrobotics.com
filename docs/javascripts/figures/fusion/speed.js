// Same path, same sensors, driven faster. The sensor rate is in hertz, so
// speed spreads the fixes out along the ground.

import { C, at, THREE, rover, post, mat, Ribbon, Ellipse } from '../lib.js'
import { Sim, LANDMARKS, BASE_SPEED, path, lapRms } from './ekf.js'

const SPEEDS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]

export default function mount(fig) {
  const stage = fig.stage({ width: 7.8, target: [0, 0.3, 0], az: 0, el: 42, grid: 20 })
  const loop = new Ribbon(130, C.muted, 0.05, 0.45)
  loop.set(Array.from({ length: 129 }, (_, i) => path((i / 128) * 2 * Math.PI)), 0.015)
  stage.scene.add(loop.mesh)
  for (const [x, y] of LANDMARKS) stage.scene.add(at(post(C.muted, 0.8), x, y))

  const truth = rover(C.truth)
  const est = rover(C.est, 0.9)
  const trail = new Ribbon(500, C.est, 0.06)
  const ell = new Ellipse(C.est)
  const MAX = 160
  const ticks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14), mat(C.meas), MAX)
  ticks.frustumCulled = false
  ticks.count = 0
  stage.scene.add(truth, est, trail.mesh, ell.group, ticks)

  const speed = fig.slider('speed', { min: 0.5, max: 4, step: 0.1, value: 1, fmt: (v) => (v * BASE_SPEED).toFixed(1) + ' m/s' })
  const rate = fig.slider('camera rate', { min: 1, max: 10, step: 0.5, value: 2, fmt: (v) => v.toFixed(1) + ' Hz' })
  const chart = fig.chart({ ylabel: 'RMS error over a lap', xlabel: 'speed →' })

  let curve = []
  function sweep() {
    curve = SPEEDS.map((s) => [s, lapRms({ speed: s, fixRate: rate.value })])
  }
  rate.on = sweep
  sweep()

  const sim = new Sim({ seed: 9 })
  const m4 = new THREE.Matrix4()
  let pts = []
  let acc = 0
  let k = 0
  let nt = 0

  stage.update = (dt) => {
    Object.assign(sim.o, { speed: speed.value, fixRate: rate.value })
    acc += dt
    while (acc > 1 / 60) {
      acc -= 1 / 60
      sim.step(1 / 60)
      if (sim.fixed.length) {
        m4.makeTranslation(sim.truth[0], 0.03, sim.truth[1])
        ticks.setMatrixAt(nt % MAX, m4)
        ticks.count = Math.min(++nt, MAX)
        ticks.instanceMatrix.needsUpdate = true
      }
      if (k++ % 2 === 0) {
        pts.push([sim.x[0], sim.x[1]])
        if (pts.length > 500) pts.shift()
      }
    }
    truth.setPose(...sim.truth)
    est.setPose(...sim.x)
    trail.set(pts, 0.025)
    ell.set(sim.x[0], sim.x[1], sim.P[0], sim.P[1], sim.P[4], 3)

    // Interpolate the precomputed sweep at the current speed.
    const s = speed.value
    const i = Math.min(SPEEDS.length - 2, Math.max(0, Math.floor((s - 0.5) / 0.5)))
    const f = (s - SPEEDS[i]) / 0.5
    const rms = curve[i][1] + (curve[i + 1][1] - curve[i][1]) * f
    chart.set(curve, s)
    fig.readout(
      `one fix every <b>${((s * BASE_SPEED) / rate.value).toFixed(2)} m</b> of travel · RMS error <b class="meas">${rms.toFixed(2)} m</b>`,
    )
  }
}
