// Localization and moving-object tracking as two estimators that depend on
// each other. The rover localizes with the same filter as the drift figure.
// It also measures range and bearing to a drone and tracks it in the world
// frame, which means every drone measurement is placed using the rover's own
// pose estimate. Treating the drone as a fixed landmark shows the opposite
// dependence: a moving object corrupts a localizer that assumes a static world.

import { C, at, rng, deg, wrap, rover, drone, shadow, post, Ribbon, Ellipse, Segs } from '../lib.js'
import { Sim, LANDMARKS, path } from './ekf.js'
import { CV } from './lsq.js'

const ALT = 1.3
const SIG_R = 0.1
const SIG_B = 0.02
export const target = (t) => [2.7 * Math.cos(-0.33 * t + 1), 1.7 * Math.sin(-0.33 * t + 1)]

export class Slammot {
  constructor(seed = 5) {
    this.sim = new Sim({ seed })
    this.r = rng(seed + 100)
    this.t = 0
    this.acc = 0
    const p = target(0)
    this.track = new CV(p[0], p[1], 0, 0, 0.2, 1)
    this.anchor = null // where the drone was when it was taken for a landmark
    this.meas = null
  }

  step(dt, { fixes, gyroBias, asLandmark }) {
    const sim = this.sim
    Object.assign(sim.o, { fixes, gyroBias })
    sim.step(dt)
    this.t += dt
    this.acc += dt
    this.track.predict(dt, 1.2)
    this.meas = null
    if (this.acc < 0.1) return
    this.acc = 0
    const o = target(this.t)
    const dx = o[0] - sim.truth[0]
    const dy = o[1] - sim.truth[1]
    const z = [Math.hypot(dx, dy) + SIG_R * this.r.n(), wrap(Math.atan2(dy, dx) - sim.truth[2] + SIG_B * this.r.n())]
    // Tracking: the measurement is placed in the world with the estimated pose.
    const a = sim.x[2] + z[1]
    this.track.update(sim.x[0] + z[0] * Math.cos(a), sim.x[1] + z[0] * Math.sin(a), 0.15 ** 2)
    this.meas = o
    // Localization, if the drone is wrongly believed to be part of the map.
    if (!asLandmark) this.anchor = null
    else {
      this.anchor ||= [...o]
      sim.update(this.anchor, z)
    }
  }

  errors() {
    const o = target(this.t)
    return { ego: this.sim.err(this.sim.x), track: Math.hypot(this.track.x[0] - o[0], this.track.x[2] - o[1]) }
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.8, target: [0, 0.4, 0], az: 0, el: 42, grid: 20 })
  const lap = new Ribbon(130, C.muted, 0.05, 0.45)
  lap.set(Array.from({ length: 129 }, (_, i) => path((i / 128) * 2 * Math.PI)), 0.015)
  stage.scene.add(lap.mesh)
  for (const [x, y] of LANDMARKS) stage.scene.add(at(post(C.muted, 0.8), x, y))

  const ego = rover(C.truth)
  const egoEst = rover(C.est, 0.9)
  const ell = new Ellipse(C.est)
  const obj = drone(C.truth, 1, 1.2)
  const objEst = drone(C.est, 0.85, 1.2)
  const shade = shadow(0.36)
  const tTrack = new Ribbon(400, C.est, 0.06)
  const ray = new Segs(1, C.meas, 0.99)
  const ghost = at(post(C.meas, 0.8), 0, 0)
  stage.scene.add(ego, egoEst, ell.group, obj, objEst, shade, tTrack.mesh, ray.mesh, ghost)
  const lEgo = stage.label('rover estimate', 'est')
  const lObj = stage.label('drone track', 'est')
  const lGhost = stage.label('mapped as a landmark here', 'meas')

  const fixes = fig.toggle('landmark fixes', true)
  const asLm = fig.toggle('treat the drone as a landmark', false)
  const bias = fig.slider('gyro bias', { min: 0, max: 3, step: 0.1, value: 1, fmt: (v) => v.toFixed(1) + ' °/s' })

  let s, pts, acc, flash
  function restart() {
    s = new Slammot(5)
    pts = []
    acc = flash = 0
  }
  restart()
  fig.button('restart', restart)

  stage.update = (dt) => {
    acc += dt
    while (acc > 1 / 60) {
      acc -= 1 / 60
      s.step(1 / 60, { fixes: fixes.value, gyroBias: bias.value * deg, asLandmark: asLm.value })
      if (s.meas) {
        flash = 1
        ray.begin()
        ray.add(s.sim.truth[0], 0.45, s.sim.truth[1], s.meas[0], ALT, s.meas[1])
        ray.end()
        pts.push([s.track.x[0], s.track.x[2]])
        if (pts.length > 400) pts.shift()
      }
      const e = s.errors()
      if (e.ego > 7 || !isFinite(e.ego)) restart()
    }
    flash = Math.max(0, flash - dt * 6)
    ray.mesh.material.opacity = 0.25 + flash * 0.5
    const sim = s.sim
    const o = target(s.t)
    ego.setPose(...sim.truth)
    egoEst.setPose(...sim.x)
    ell.set(sim.x[0], sim.x[1], sim.P[0], sim.P[1], sim.P[4], 3)
    obj.position.set(o[0], ALT, o[1])
    shade.position.set(o[0], 0.012, o[1])
    objEst.position.set(s.track.x[0], ALT, s.track.x[2])
    tTrack.set(pts, ALT - 0.03)
    lEgo.pos.set(sim.x[0], 0.7, sim.x[1])
    lEgo.dy = 52
    lObj.pos.set(s.track.x[0], ALT + 0.3, s.track.x[2])
    ghost.visible = lGhost.show = !!s.anchor
    if (s.anchor) {
      ghost.position.set(s.anchor[0], 0, s.anchor[1])
      lGhost.pos.set(s.anchor[0], 1, s.anchor[1])
    }
    const e = s.errors()
    fig.readout(`rover position: <b class="est">${e.ego.toFixed(2)} m</b> off · drone track: <b class="est">${e.track.toFixed(2)} m</b> off`)
  }
}
