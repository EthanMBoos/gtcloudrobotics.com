// Planning by sampling (the cross-entropy method): sample action sequences,
// roll each one through the model, keep the ones that end nearest the goal,
// resample around them. Then fly the plan in the real dynamics.

import { C, THREE, rng, drone, shadow, ball, mat, Ribbon, Segs, clamp } from '../lib.js'
import { ALT, DT, trueStep, modelStep, dist } from './world.js'

export const H = 8 // actions in a plan
export const HOLD = 5 // model steps per action, 0.5 s
export const PASSES = 7
const MAXFLY = 70 // step cap when replanning
const MODEL = { cov: 0.6, eps: 0.1 } // knows some of the wind, not all
const OB = { x: 0, y: 0, r: 1.15 }

export const blank = (v) => Array.from({ length: H }, () => [v, v])

// Roll an action sequence through the model. keep: 'ends' | 'all' | falsy.
export function rollout(start, seq, g, keep) {
  let q = start
  let cost = 0
  const pts = keep ? [[q[0], q[1]]] : null
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < HOLD; j++) {
      q = modelStep(q, seq[i], MODEL)
      if (keep === 'all') pts.push([q[0], q[1]])
      if (Math.hypot(q[0] - OB.x, q[1] - OB.y) < OB.r + 0.25) cost += 4
    }
    if (keep === 'ends') pts.push([q[0], q[1]])
    cost += 0.5 * dist(q, g)
  }
  cost += 3 * dist(q, g) + 0.5 * Math.hypot(q[2], q[3])
  return { cost, pts }
}

// One CEM pass. Refits mu and sd in place around the best samples.
export function cemPass(s, g, mu, sd, n, r) {
  const runs = []
  for (let i = 0; i < n; i++) {
    const seq = mu.map((m, t) => [clamp(m[0] + sd[t][0] * r.n(), -1, 1), clamp(m[1] + sd[t][1] * r.n(), -1, 1)])
    runs.push({ seq, ...rollout(s, seq, g, 'ends') })
  }
  runs.sort((a, b) => a.cost - b.cost)
  const top = runs.slice(0, Math.max(3, Math.round(n * 0.12)))
  for (let t = 0; t < H; t++) {
    for (let d = 0; d < 2; d++) {
      const m = top.reduce((v, e) => v + e.seq[t][d], 0) / top.length
      const v = top.reduce((x, e) => x + (e.seq[t][d] - m) ** 2, 0) / top.length
      mu[t][d] = m
      sd[t][d] = Math.max(Math.sqrt(v), 0.05)
    }
  }
  return { rest: runs.slice(top.length), top }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 6.2, target: [0, 0.6, 0], az: 0, el: 40, grid: 16 })
  const craft = drone(C.truth, 1, 1.2)
  const shade = shadow(0.4)
  const goal = ball(C.goal, 0.2)
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(OB.r - 0.25, OB.r - 0.25, 2.2, 40), mat(C.muted, 0.45))
  tower.position.set(OB.x, 1.1, OB.y)
  const samples = new Segs(200 * H, C.muted, 0.35)
  const elites = new Segs(30 * H, C.goal, 0.9)
  const plan = new Ribbon(H * HOLD + 1, C.est, 0.08)
  const flown = new Ribbon(MAXFLY + 2, C.truth, 0.06)
  stage.scene.add(craft, shade, goal, tower, samples.mesh, elites.mesh, plan.mesh, flown.mesh)
  const lGoal = stage.label('goal', 'goal')
  stage.label('no-fly').pos.set(OB.x, 2.4, OB.y)

  const count = fig.slider('samples', { min: 8, max: 200, step: 4, value: 96, fmt: (v) => v.toFixed(0) })
  const replan = fig.toggle('replan as it flies', false)
  fig.button('new goal', () => newGoal())

  const r = rng(21)
  let s = [-4, -1.8, 0, 0]
  let g = [1.6, 1.9]
  let mu = []
  let sd = []
  let phase = 'plan' // plan -> fly -> rest
  let pass = 0
  let clock = 0
  let acc = 0
  let k = 0
  let steps = 0
  let path = []
  let miss = null

  function cem() {
    const { rest, top } = cemPass(s, g, mu, sd, count.value, r)
    const draw = (segs, list) => {
      segs.begin()
      for (const e of list) for (let i = 0; i < H; i++) segs.add(e.pts[i][0], ALT, e.pts[i][1], e.pts[i + 1][0], ALT, e.pts[i + 1][1])
      segs.end()
    }
    draw(samples, rest)
    draw(elites, top)
    plan.set(rollout(s, mu, g, 'all').pts, ALT + 0.02)
  }

  function startPlan() {
    mu = blank(0)
    sd = blank(0.8)
    phase = 'plan'
    pass = 0
    clock = 0.4
    path = [[s[0], s[1]]]
    flown.set(path, ALT)
  }

  function newGoal() {
    if (Math.abs(s[0]) > 5 || Math.abs(s[1]) > 3.2) s = [-4, -1.8, 0, 0]
    for (let i = 0; i < 80; i++) {
      g = [(r() * 2 - 1) * 4.4, (r() * 2 - 1) * 2.6]
      const d = dist(g, s)
      if (d > 3.5 && d < 6.5 && Math.hypot(g[0] - OB.x, g[1] - OB.y) > OB.r + 0.8) break
    }
    miss = null
    startPlan()
  }
  startPlan()

  stage.update = (dt) => {
    clock += dt
    if (phase === 'plan' && clock > 0.5) {
      clock = 0
      cem()
      if (++pass === PASSES) {
        phase = 'fly'
        k = 0
        steps = 0
        acc = 0
      }
    } else if (phase === 'fly') {
      acc += dt
      while (phase === 'fly' && acc > DT) {
        acc -= DT
        s = trueStep(s, mu[Math.min(Math.floor(k / HOLD), H - 1)])
        path.push([s[0], s[1]])
        k++
        steps++
        let done = k >= H * HOLD
        if (replan.value && !done && k === HOLD) {
          // Drop the action just flown, keep the rest as the starting guess.
          mu = [...mu.slice(1), [0, 0]]
          sd = blank(0.3)
          for (let i = 0; i < 4; i++) cem()
          k = 0
          done = steps >= MAXFLY || (dist(s, g) < 0.25 && Math.hypot(s[2], s[3]) < 0.5)
        }
        if (done) {
          miss = dist(s, g)
          phase = 'rest'
          clock = 0
        }
      }
      flown.set(path, ALT + 0.03)
    } else if (phase === 'rest' && clock > 2.2) {
      newGoal()
    }
    craft.position.set(s[0], ALT, s[1])
    shade.position.set(s[0], 0.012, s[1])
    goal.position.set(g[0], ALT, g[1])
    lGoal.pos.set(g[0], ALT + 0.25, g[1])
    fig.readout(
      phase === 'plan'
        ? `planning in the model: pass <b>${Math.min(pass + 1, PASSES)}</b> of ${PASSES}`
        : phase === 'fly'
          ? 'flying the plan for real'
          : `stopped <b class="meas">${miss.toFixed(2)} m</b> from the goal`,
    )
  }
}
