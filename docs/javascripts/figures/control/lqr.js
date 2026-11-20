// Gains computed from a cost. The reader sets the weights; the linear
// quadratic regulator returns the two gains.

import { C } from '../lib.js'
import { Axis, lqr } from './sim.js'
import { axisFig, STEP } from './axis.js'

export default function mount(fig) {
  const ax = new Axis()
  const wp = fig.slider('position weight', { min: 0, max: 3, step: 0.05, value: 2, fmt: (v) => (10 ** v).toPrecision(2) * 1 + ' × effort' })
  const wv = fig.slider('velocity weight', { min: -1, max: 2.5, step: 0.05, value: 1, fmt: (v) => (10 ** v).toPrecision(2) * 1 + ' × effort' })
  const size = fig.choice([[5, '5 m move'], [20, '20 m move']], 5)

  let K = [0, 0]
  axisFig(fig, {
    vehicles: [{ ax, color: C.truth, ctrl: (e, v) => -K[0] * e - K[1] * v }],
    period: 9,
    dist: () => size.value,
    scale: () => (size.value === 5 ? 1 : 0.3),
    apply: () => {
      K = lqr(10 ** wp.value, 10 ** wv.value, 1, STEP).K
    },
    after: ({ vs }) => {
      const sat = Math.abs(ax.us) >= ax.o.umax - 1e-6
      fig.readout(
        `gains from the cost: <b>${K[0].toFixed(1)}</b> on position, <b>${K[1].toFixed(1)}</b> on velocity · ` +
          `overshoot <b class="meas">${Math.max(vs[0].peak, 0).toFixed(1)} m</b>` +
          (sat ? ' · <b class="brass">at the acceleration limit</b>' : ''),
      )
    },
  })
}
