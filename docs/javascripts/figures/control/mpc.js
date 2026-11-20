// Model predictive control against the clipped linear law, on a 20 m move
// with the acceleration limited to 5 m/s^2. The blue ribbon is the plan,
// which is solved again at every step.

import { C, Ribbon, clamp } from '../lib.js'
import { Axis, Mpc } from './sim.js'
import { axisFig, STEP } from './axis.js'

const UMAX = 5
const WIND = 1.5

export default function mount(fig) {
  const ax = new Axis({ umax: UMAX })
  const ref = new Axis({ umax: UMAX })
  const horizon = fig.slider('horizon', { min: 5, max: 60, step: 1, value: 40, fmt: (v) => `${v} steps, ${(v * STEP).toFixed(2)} s` })
  const wind = fig.toggle('wind', false)
  const estimate = fig.toggle('estimate the wind', false)

  let mpc = new Mpc({ N: horizon.value, h: STEP })
  let dHat = 0
  let vPred = null
  let u0 = 0
  const plan = new Ribbon(62, C.est, 0.1)

  const api = axisFig(fig, {
    vehicles: [
      {
        ax,
        color: C.truth,
        label: 'MPC',
        ctrl: (e, v) => {
          // Compare the velocity the model predicted with the one measured.
          if (estimate.value && vPred != null) dHat = clamp(dHat + 0.25 * ((v - vPred) / STEP), -UMAX, UMAX)
          if (!estimate.value) dHat = 0
          const w = mpc.solve(e, v, -UMAX + dHat, UMAX + dHat, 30)
          mpc.shift()
          u0 = w - dHat
          vPred = v + STEP * w
          return u0
        },
      },
      { ax: ref, color: C.brass, label: 'fixed gains', cls: 'brass', ctrl: (e, v) => -mpc.K[0] * e - mpc.K[1] * v },
    ],
    period: 9,
    dist: () => 20,
    scale: () => 0.3,
    apply: () => {
      if (mpc.N !== horizon.value) mpc = new Mpc({ N: horizon.value, h: STEP })
      ax.d = ref.d = wind.value ? WIND : 0
    },
    restart: () => {
      mpc.U.fill(0)
      dHat = 0
      vPred = null
    },
    after: ({ vs }) => {
      fig.readout(
        `planned <b class="est">${mpc.N}</b> inputs, applied the first: <b>${u0.toFixed(1)} m/s²</b> · overshoot ` +
          `<b>${Math.max(vs[0].peak, 0).toFixed(1)} m</b> with the plan, <b class="brass">${Math.max(vs[1].peak, 0).toFixed(1)} m</b> without`,
      )
    },
    draw: ({ YV, TS, target, scale, vs }, a) => {
      // The rest of the last plan. The drone is drawn part-way through the
      // step in progress, so the plan starts (1 - a) of a step ahead of it.
      const pts = mpc.plan(ax.p - target(), ax.v).map((p, k) => [(p + target()) * scale(), YV + (k + 1 - a) * STEP * TS])
      plan.set([[vs[0].x, YV], ...pts], 0.03)
      const end = pts[pts.length - 1]
      lPlan.pos.set(end[0], 0.03, end[1])
    },
  })
  api.stage.scene.add(plan.mesh)
  const lPlan = api.stage.label('plan', 'est')
  lPlan.dy = 34
  fig.button('shove', () => {
    ax.v += 5
    ref.v += 5
    vPred = null // a shove is not wind
  })
}
