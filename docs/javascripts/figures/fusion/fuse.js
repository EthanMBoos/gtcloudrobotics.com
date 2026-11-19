// The Kalman loop on a 2D position belief. Moving shifts and widens the
// belief; a measurement multiplies it with a second bump and narrows it.

import { C, rng, rover, Surface, Ellipse, clamp } from '../lib.js'

const STEP = 1.1

export default function mount(fig) {
  const stage = fig.stage({ width: 5.2, target: [0, 1.0, 0], az: 12, el: 26, grid: 16 })
  const robot = rover()
  const belief = new Surface(52, [-3, 3, -3, 3], C.est, 0.8)
  const meas = new Surface(52, [-3, 3, -3, 3], C.meas, 0.7)
  const eB = new Ellipse(C.est, 0.1)
  const eM = new Ellipse(C.meas, 0.08)
  stage.scene.add(robot, belief.mesh, meas.mesh, eB.group, eM.group)
  const lB = stage.label('belief', 'est')
  const lM = stage.label('measurement', 'meas')

  const sm = fig.slider('motion noise', { min: 0.05, max: 0.6, step: 0.01, value: 0.3, fmt: (v) => v.toFixed(2) + ' m' })
  const sz = fig.slider('sensor noise', { min: 0.1, max: 1.2, step: 0.01, value: 0.5, fmt: (v) => v.toFixed(2) + ' m' })
  const auto = fig.toggle('auto', true)
  fig.button('move', () => {
    auto.set(false)
    move()
  })
  fig.button('measure', () => {
    auto.set(false)
    measure()
  })

  const r = rng(3)
  let truth = [-4.2, 0]
  let m = [-4.2, 0] // belief mean
  let P = [0.09, 0, 0.09] // xx, xy, yy
  let dm = [...m] // what is drawn, eased toward m and P
  let dP = [...P]
  let z = [0, 0]
  let zFade = 0
  let gain = null
  let clock = 0
  let phase = 0

  function move() {
    const s = sm.value
    truth = [truth[0] + STEP + s * r.n(), truth[1] + 0.4 * s * r.n()]
    m = [m[0] + STEP, m[1]]
    P = [P[0] + s * s, P[1], P[2] + 0.16 * s * s]
    gain = null
    if (truth[0] > 4.4) {
      for (const p of [truth, m, dm]) p[0] -= 8.6
      truth[1] = 0
      m = [truth[0], 0]
      dm = [...m]
      P = [0.09, 0, 0.09]
    }
  }

  function measure() {
    const R = sz.value ** 2
    z = [truth[0] + sz.value * r.n(), truth[1] + sz.value * r.n()]
    zFade = 1
    // K = P (P + R)^-1
    const a = P[0] + R
    const b = P[1]
    const d = P[2] + R
    const det = a * d - b * b
    const K = [(P[0] * d - P[1] * b) / det, (-P[0] * b + P[1] * a) / det, (P[1] * d - P[2] * b) / det, (-P[1] * b + P[2] * a) / det]
    const y = [z[0] - m[0], z[1] - m[1]]
    m = [m[0] + K[0] * y[0] + K[1] * y[1], m[1] + K[2] * y[0] + K[3] * y[1]]
    P = [(1 - K[0]) * P[0] - K[1] * P[1], (1 - K[0]) * P[1] - K[1] * P[2], -K[2] * P[1] + (1 - K[3]) * P[2]]
    gain = K[0]
  }

  const bump = (p) => {
    const det = Math.max(p[0] * p[2] - p[1] * p[1], 1e-6)
    const amp = clamp(1.2 * Math.sqrt(0.25 / Math.sqrt(det)), 0.3, 3.2)
    return [(x, y) => amp * Math.exp(-0.5 * ((p[2] * x * x - 2 * p[1] * x * y + p[0] * y * y) / det)), amp]
  }

  stage.update = (dt) => {
    if (auto.value) {
      clock += dt
      if (clock > 1.3) {
        clock = 0
        if (phase++ % 3 === 2) measure()
        else move()
      }
    }
    const k = 1 - Math.exp(-dt * 7)
    for (let i = 0; i < 2; i++) dm[i] += (m[i] - dm[i]) * k
    for (let i = 0; i < 3; i++) dP[i] += (P[i] - dP[i]) * k
    zFade = Math.max(0, zFade - dt / 2.2)

    robot.setPose(truth[0], truth[1], 0)
    const [fb, ab] = bump(dP)
    belief.mesh.position.set(dm[0], 0, dm[1])
    belief.update(fb, ab)
    eB.set(dm[0], dm[1], dP[0], dP[1], dP[2])
    lB.pos.set(dm[0], ab + 0.15, dm[1])

    const R = sz.value ** 2
    const [fz, az] = bump([R, 0, R])
    meas.mesh.visible = eM.group.visible = lM.show = zFade > 0.02
    meas.mesh.material.opacity = Math.min(1, zFade * 2)
    meas.mesh.position.set(z[0], 0, z[1])
    meas.update(fz, az)
    eM.set(z[0], z[1], R, 0, R)
    lM.pos.set(z[0], az + 0.15, z[1])

    const sd = Math.sqrt(dP[0]).toFixed(2)
    fig.readout(
      gain == null
        ? `belief spread <b>${sd} m</b> along the direction of travel`
        : `belief spread <b>${sd} m</b> · moved <b>${Math.round(gain * 100)}%</b> of the way to the measurement`,
    )
  }
}
