// Altitude hold with and without feedback, under proportional and derivative
// action. The hover thrust is computed for a mass that is slightly wrong.

import { rng } from '../lib.js'
import { Alt } from './sim.js'
import { altFig } from './common.js'

export default function mount(fig) {
  const sim = new Alt({ rand: rng(3).n })
  const fb = fig.toggle('feedback', true)
  const mass = fig.slider('mass error', { min: 0, max: 10, step: 1, value: 5, fmt: (v) => v.toFixed(0) + ' %' })
  const kp = fig.slider('proportional gain', { min: 0, max: 30, step: 0.5, value: 4, fmt: (v) => v.toFixed(1) })
  const kd = fig.slider('derivative gain', { min: 0, max: 12, step: 0.25, value: 4, fmt: (v) => v.toFixed(2) })

  altFig(fig, {
    sim,
    levels: () => [1.5, 3.5],
    scale: () => 1,
    apply: () => Object.assign(sim.o, { feedback: fb.value, extra: mass.value / 100, kp: kp.value, kd: kd.value }),
    after: () => {
      if (!fb.value) return fig.readout('no feedback: the thrust is fixed at the hover value for the assumed mass')
      const w = Math.sqrt(kp.value)
      const zeta = w > 0 ? kd.value / (2 * w) : 0
      fig.readout(
        `error <b class="meas">${sim.e.toFixed(2)} m</b> · natural frequency <b>${w.toFixed(1)} rad/s</b> · damping ratio <b>${zeta.toFixed(2)}</b>`,
      )
    },
  })
}
