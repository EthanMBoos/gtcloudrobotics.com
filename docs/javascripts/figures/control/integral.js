// A payload the controller does not know about. Brass flies proportional and
// derivative action only; dark adds integral action.

import { G } from './sim.js'
import { Alt } from './sim.js'
import { altFig } from './common.js'

export default function mount(fig) {
  const sim = new Alt()
  const ghost = new Alt()
  const load = fig.slider('payload', { min: 0, max: 30, step: 1, value: 10, fmt: (v) => v.toFixed(0) + ' % of mass' })
  const ki = fig.slider('integral gain', { min: 0, max: 20, step: 0.25, value: 1.5, fmt: (v) => v.toFixed(2) })

  const { stage, X0 } = altFig(fig, {
    sim,
    ghost,
    period: 8,
    levels: () => [1.5, 3.5],
    scale: () => 1,
    apply: () => {
      sim.o.extra = ghost.o.extra = load.value / 100
      sim.o.ki = ki.value
    },
    after: () => {
      lG.pos.set(X0 + 1.1, ghost.z + 0.25, 0)
      fig.readout(
        `without integral action: <b class="brass">${ghost.e.toFixed(2)} m</b> low · with: <b>${sim.e.toFixed(2)} m</b> · ` +
          `integral term <b>${(sim.o.ki * sim.i).toFixed(2)}</b> of ${(G * sim.o.extra).toFixed(2)} m/s² missing`,
      )
    },
  })
  const lG = stage.label('no integral', 'brass')
}
