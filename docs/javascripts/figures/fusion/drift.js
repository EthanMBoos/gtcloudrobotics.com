// Odometry alone against the same odometry corrected by landmark fixes.

import { C, at, THREE, rover, post, Ribbon, Ellipse, Segs, deg } from '../lib.js'
import { Sim, LANDMARKS, path } from './ekf.js'

export default function mount(fig) {
  const stage = fig.stage({ width: 7.8, target: [0, 0.3, 0], az: 0, el: 42, grid: 20 })
  const loop = new Ribbon(130, C.muted, 0.05, 0.45)
  loop.set(Array.from({ length: 129 }, (_, i) => path((i / 128) * 2 * Math.PI)), 0.015)
  stage.scene.add(loop.mesh)
  for (const [x, y] of LANDMARKS) stage.scene.add(at(post(C.muted, 0.8), x, y))

  const truth = rover(C.truth)
  const dr = rover(C.brass, 0.75)
  const est = rover(C.est, 0.9)
  const tDr = new Ribbon(900, C.brass, 0.06)
  const tEst = new Ribbon(900, C.est, 0.06)
  const ell = new Ellipse(C.est)
  const rays = new Segs(LANDMARKS.length, C.meas, 0.99)
  stage.scene.add(truth, dr, est, tDr.mesh, tEst.mesh, ell.group, rays.mesh)
  const lDr = stage.label('odometry only', 'brass')
  const lEst = stage.label('with fixes', 'est')

  const fixes = fig.toggle('landmark fixes', true)
  const bias = fig.slider('gyro bias', { min: 0, max: 3, step: 0.1, value: 1, fmt: (v) => v.toFixed(1) + ' °/s' })
  const rate = fig.slider('fix rate', { min: 0.5, max: 10, step: 0.5, value: 2, fmt: (v) => v.toFixed(1) + ' Hz' })

  const sim = new Sim({ seed: 5 })
  let pDr = []
  let pEst = []
  let acc = 0
  let k = 0
  let flash = 0
  function restart() {
    sim.reset()
    pDr = []
    pEst = []
  }
  fig.button('restart', restart)

  stage.update = (dt) => {
    Object.assign(sim.o, { fixes: fixes.value, gyroBias: bias.value * deg, fixRate: rate.value })
    acc += dt
    while (acc > 1 / 60) {
      acc -= 1 / 60
      sim.step(1 / 60)
      if (sim.fixed.length) {
        flash = 1
        rays.begin()
        for (const lm of sim.fixed) rays.add(sim.truth[0], 0.4, sim.truth[1], lm[0], 0.8, lm[1])
        rays.end()
      }
      if (k++ % 3 === 0) {
        pDr.push([sim.dr[0], sim.dr[1]])
        pEst.push([sim.x[0], sim.x[1]])
        if (pDr.length > 900) {
          pDr.shift()
          pEst.shift()
        }
      }
      if (sim.err(sim.dr) > 7) restart()
    }
    flash = Math.max(0, flash - dt * 5)
    rays.mesh.material.opacity = flash * 0.8
    truth.setPose(...sim.truth)
    dr.setPose(...sim.dr)
    est.setPose(...sim.x)
    tDr.set(pDr, 0.02)
    tEst.set(pEst, 0.025)
    const P = sim.P
    ell.set(sim.x[0], sim.x[1], P[0], P[1], P[4], 3)
    lDr.pos.set(sim.dr[0], 0.7, sim.dr[1])
    lEst.pos.set(sim.x[0], 0.7, sim.x[1])
    lEst.dy = 52
    fig.readout(
      `odometry only: <b class="brass">${sim.err(sim.dr).toFixed(2)} m</b> off · ` +
        (fixes.value ? 'with fixes' : 'filter, no fixes') +
        `: <b class="est">${sim.err(sim.x).toFixed(2)} m</b> off`,
    )
  }
}
