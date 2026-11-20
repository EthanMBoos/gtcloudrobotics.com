// Steps of different sizes against a thrust limit. Large steps saturate the
// motors, and the overshoot grows with the size of the step.

import { G, Alt } from './sim.js'
import { altFig, thrustChart } from './common.js'

const SCALE = { 1: 1.6, 3: 0.72, 10: 0.24 }

export default function mount(fig) {
  const sim = new Alt({ kp: 25, ki: 10, kd: 7, antiWindup: false })
  const size = fig.choice([[1, '1 m step'], [3, '3 m step'], [10, '10 m step']], 3)
  const aw = fig.toggle('integrator clamp', false)
  const integ = fig.toggle('integral action', true)
  const chart = thrustChart(fig)

  let over = 0
  let peak = 0
  let dir = 0
  altFig(fig, {
    sim,
    period: 7,
    levels: () => [1, 1 + size.value],
    scale: () => SCALE[size.value],
    apply: () => Object.assign(sim.o, { antiWindup: aw.value, ki: integ.value ? 10 : 0 }),
    restart: () => {
      over = peak = dir = 0
    },
    flip: (up) => {
      dir = up ? 1 : -1
      peak = 0
    },
    after: () => {
      if (dir) peak = Math.max(peak, (dir * (sim.z - sim.ref)) / size.value)
      over = peak
      const sat = sim.u > 2 * G || sim.u < 0
      fig.readout(
        `overshoot <b class="meas">${(over * 100).toFixed(0)} %</b> of the step · commanded ` +
          `<b class="${sat ? 'meas' : ''}">${sim.u.toFixed(1)} m/s²</b>, available 0 to ${(2 * G).toFixed(1)}`,
      )
    },
    draw: chart,
  })
}
