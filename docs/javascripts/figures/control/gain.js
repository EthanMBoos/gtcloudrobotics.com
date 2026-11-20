// What stops the gain from being raised: sensor noise through the derivative
// term, and the lag and delay between a command and the thrust.

import { rng } from '../lib.js'
import { Alt } from './sim.js'
import { altFig, thrustChart } from './common.js'

export default function mount(fig) {
  const sim = new Alt({ rand: rng(11).n })
  const speed = fig.slider('loop speed', { min: 1, max: 14, step: 0.5, value: 5, fmt: (v) => v.toFixed(1) + ' rad/s' })
  const delay = fig.slider('delay', { min: 0, max: 150, step: 10, value: 30, fmt: (v) => v.toFixed(0) + ' ms' })
  const filt = fig.slider('derivative filter', { min: 0, max: 100, step: 5, value: 0, fmt: (v) => v.toFixed(0) + ' ms' })
  const noise = fig.toggle('sensor noise', true)
  const chart = thrustChart(fig)

  const win = []
  altFig(fig, {
    sim,
    period: 5,
    levels: () => [1.3, 1.7],
    scale: () => 2,
    apply: () =>
      Object.assign(sim.o, {
        kp: speed.value ** 2,
        kd: 1.4 * speed.value,
        delay: delay.value / 1000,
        tf: filt.value / 1000,
        noise: noise.value ? 0.01 : 0,
      }),
    after: () => {
      win.push(sim.u)
      if (win.length > 100) win.shift()
      const mean = win.reduce((a, b) => a + b, 0) / win.length
      const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length)
      fig.readout(
        `gains <b>${sim.o.kp.toFixed(0)}</b> and <b>${sim.o.kd.toFixed(1)}</b> · ` +
          `thrust command varies by <b class="meas">${sd.toFixed(1)} m/s²</b> over the last second`,
      )
    },
    draw: chart,
  })
}
