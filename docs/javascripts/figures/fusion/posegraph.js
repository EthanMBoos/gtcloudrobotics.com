// A pose graph. The robot keeps every pose of one lap as a variable, joined
// by odometry edges. Driving back to the start adds one loop-closure edge, and
// solving the whole graph spreads the accumulated error around the lap.

import { C, rng, wrap, lerp, rover, ball, Ribbon, Segs } from '../lib.js'
import { path } from './ekf.js'
import { gaussNewton } from './lsq.js'

export const N = 36 // odometry edges in one lap
const FALSE_EDGE = [9, 27] // two poses on opposite sides of the lap

const compose = (p, d) => [p[0] + d[0] * Math.cos(p[2]) - d[1] * Math.sin(p[2]), p[1] + d[0] * Math.sin(p[2]) + d[1] * Math.cos(p[2]), wrap(p[2] + d[2])]
const between = (a, b) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return [dx * Math.cos(a[2]) + dy * Math.sin(a[2]), -dx * Math.sin(a[2]) + dy * Math.cos(a[2]), wrap(b[2] - a[2])]
}

// True poses round the lap, and what the odometry and loop detector report.
export function world(seed, bias) {
  const r = rng(seed)
  const truth = []
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * 2 * Math.PI
    const a = path(s)
    const b = path(s + 1e-3)
    truth.push([a[0], a[1], Math.atan2(b[1] - a[1], b[0] - a[0])])
  }
  const odo = []
  for (let i = 0; i < N; i++) {
    const d = between(truth[i], truth[i + 1])
    odo.push([d[0] * (1 + 0.03 * r.n()), d[1] + 0.01 * r.n(), d[2] + bias + 0.008 * r.n()])
  }
  const loop = between(truth[0], truth[N]).map((v, k) => v + (k < 2 ? 0.03 : 0.01) * r.n())
  return { truth, odo, loop }
}

// Least-squares poses 0..n for the active edges, starting from `init`.
export function solveGraph(init, w, n, useLoop, useFalse) {
  const x = init.slice(0, n + 1).flat()
  const edges = []
  for (let i = 0; i < n; i++) edges.push([i, i + 1, w.odo[i], 0.06, 0.03])
  if (useLoop && n >= N) edges.push([0, N, w.loop, 0.04, 0.02])
  if (useFalse && n >= FALSE_EDGE[1]) edges.push([...FALSE_EDGE, [0, 0, 0], 0.04, 0.02])
  const P = (x, i) => [x[3 * i], x[3 * i + 1], x[3 * i + 2]]
  gaussNewton(x, (x) => {
    const out = [(x[0] - init[0][0]) * 100, (x[1] - init[0][1]) * 100, wrap(x[2] - init[0][2]) * 100]
    for (const [i, j, z, st, sr] of edges) {
      const d = between(P(x, i), P(x, j))
      out.push((d[0] - z[0]) / st, (d[1] - z[1]) / st, wrap(d[2] - z[2]) / sr)
    }
    return out
  }, 12)
  return Array.from({ length: n + 1 }, (_, i) => [x[3 * i], x[3 * i + 1], wrap(x[3 * i + 2])])
}

export const meanErr = (a, b) => a.reduce((s, p, i) => s + Math.hypot(p[0] - b[i][0], p[1] - b[i][1]), 0) / a.length

export default function mount(fig) {
  const stage = fig.stage({ width: 7.8, target: [0, 0.3, 0], az: 0, el: 44, grid: 20 })
  const lap = new Ribbon(130, C.muted, 0.05, 0.45)
  lap.set(Array.from({ length: 129 }, (_, i) => path((i / 128) * 2 * Math.PI)), 0.015)
  const chain = new Ribbon(N + 1, C.est, 0.07)
  const nodes = Array.from({ length: N + 1 }, () => ball(C.est, 0.11))
  const closures = new Segs(2, C.meas)
  const truthBot = rover(C.truth)
  const estBot = rover(C.est, 0.9)
  stage.scene.add(lap.mesh, chain.mesh, ...nodes, closures.mesh, truthBot, estBot)
  const lLoop = stage.label('loop closure', 'meas')
  const lFalse = stage.label('false match', 'meas')

  const useLoop = fig.toggle('loop closure', true)
  const useFalse = fig.toggle('one false match', false)
  const drift = fig.slider('gyro bias', { min: 0, max: 1.5, step: 0.05, value: 0.8, fmt: (v) => v.toFixed(2) + ' °/step' })

  let seed = 3
  let w, cur, tgt, k, hold, solvedFor
  function restart() {
    w = world(seed, (drift.value * Math.PI) / 180)
    cur = [w.truth[0].slice()]
    tgt = [w.truth[0].slice()]
    k = 0
    hold = 0
    solvedFor = ''
  }
  function resolve() {
    const n = tgt.length - 1
    const key = [n >= N && useLoop.value, n >= FALSE_EDGE[1] && useFalse.value].join()
    if (key === solvedFor) return
    solvedFor = key
    // Start from dead reckoning so that switching an edge off undoes it.
    const dr = [w.truth[0].slice()]
    for (let i = 0; i < n; i++) dr.push(compose(dr[i], w.odo[i]))
    tgt = key === 'false,false' ? dr : solveGraph(dr, w, n, useLoop.value, useFalse.value)
  }
  restart()
  fig.button('new lap', () => {
    seed++
    restart()
  })
  drift.on = restart
  useLoop.on = useFalse.on = resolve

  stage.update = (dt) => {
    if (k < N) {
      k = Math.min(N, k + dt * 4.5)
      while (tgt.length - 1 < Math.floor(k)) {
        const i = tgt.length - 1
        tgt.push(compose(tgt[i], w.odo[i]))
        cur.push(compose(cur[i], w.odo[i]))
        resolve()
      }
    } else if ((hold += dt) > 7) {
      seed++
      restart()
    }
    const a = 1 - Math.exp(-dt * 5)
    cur.forEach((p, i) => {
      p[0] = lerp(p[0], tgt[i][0], a)
      p[1] = lerp(p[1], tgt[i][1], a)
      p[2] = wrap(p[2] + wrap(tgt[i][2] - p[2]) * a)
    })
    const n = cur.length - 1
    chain.set(cur.map((p) => [p[0], p[1]]), 0.03)
    nodes.forEach((m, i) => {
      m.visible = i <= n
      if (i <= n) m.position.set(cur[i][0], 0.11, cur[i][1])
    })
    // The robot itself, between the last node and the next.
    const f = k - Math.floor(k)
    const head = n < N ? compose(cur[n], w.odo[n].map((v) => v * f)) : cur[n]
    const s = (k / N) * 2 * Math.PI
    const tp = path(s)
    const tq = path(s + 1e-3)
    truthBot.setPose(tp[0], tp[1], Math.atan2(tq[1] - tp[1], tq[0] - tp[0]))
    estBot.setPose(...head)

    const loopOn = n >= N && useLoop.value
    const falseOn = n >= FALSE_EDGE[1] && useFalse.value
    closures.begin()
    if (loopOn) closures.add(cur[0][0], 0.3, cur[0][1], cur[N][0], 0.3, cur[N][1])
    if (falseOn) closures.add(cur[FALSE_EDGE[0]][0], 0.3, cur[FALSE_EDGE[0]][1], cur[FALSE_EDGE[1]][0], 0.3, cur[FALSE_EDGE[1]][1])
    closures.end()
    lLoop.show = loopOn
    if (loopOn) lLoop.pos.set(cur[0][0], 0.5, cur[0][1])
    lFalse.show = falseOn
    if (falseOn) lFalse.pos.set((cur[FALSE_EDGE[0]][0] + cur[FALSE_EDGE[1]][0]) / 2, 0.5, (cur[FALSE_EDGE[0]][1] + cur[FALSE_EDGE[1]][1]) / 2)

    fig.readout(
      `${n + 1} poses · mean position error <b class="est">${meanErr(cur, w.truth).toFixed(2)} m</b>` +
        (n >= N ? ` · gap at the start ${Math.hypot(cur[N][0] - cur[0][0], cur[N][1] - cur[0][1]).toFixed(2)} m` : ''),
    )
  }
}
