// A short imagined horizon closed with a value. The rover plans in a grid
// world it knows exactly, by looking H steps ahead. Reward is given only on
// reaching the goal. Without a value, a goal further than H steps away scores
// the same as anything else. With a value, each imagined rollout is scored by
// the value of the state it ends in. The value used here is rough: it knows
// the distance to the goal and not the wall. An H-step lookahead from a value
// v is H rounds of the Bellman backup started at v, which is how it is computed.

import { C, THREE, rng, rover, post, at, mat, Ribbon, Segs } from '../lib.js'

export const W = 15
export const H = 9
export const START = [2, 4]
export const GOAL = [12, 4]
const GAMMA = 0.95
export const LIMIT = 80
const MOVES = [[1, 0], [-1, 0], [0, 1], [0, -1]]
export const wall = (i, j) => i < 0 || j < 0 || i >= W || j >= H || (i === 8 && j >= 1)
const id = (i, j) => j * W + i
const G = id(...GOAL)
const next = (s, m) => {
  const i = (s % W) + m[0]
  const j = Math.floor(s / W) + m[1]
  return wall(i, j) ? s : id(i, j)
}

// tables[k][s]: the best score reachable from s with k steps of lookahead.
export function lookahead(h, useValue) {
  let J = new Float64Array(W * H)
  for (let s = 0; s < W * H; s++) {
    const i = s % W
    const j = Math.floor(s / W)
    J[s] = s === G ? 1 : useValue && !wall(i, j) ? GAMMA ** (Math.abs(i - GOAL[0]) + Math.abs(j - GOAL[1])) : 0
  }
  const tables = [J]
  for (let k = 0; k < h; k++) {
    const N = new Float64Array(W * H)
    for (let s = 0; s < W * H; s++) N[s] = s === G ? 1 : GAMMA * Math.max(...MOVES.map((m) => J[next(s, m)]))
    tables.push((J = N))
  }
  return tables
}

// The moves from s that are best under tables[k], then tables[k - 1], and so on.
function ties(tables, k, s) {
  let best = MOVES
  for (; k >= 0 && best.length > 1; k--) {
    const q = best.map((m) => tables[k][next(s, m)])
    const top = Math.max(...q)
    best = best.filter((_, a) => q[a] > top - 1e-12)
  }
  return best
}

export class Run {
  constructor(seed = 1) {
    this.r = rng(seed)
    this.reset()
  }

  reset() {
    this.s = id(...START)
    this.steps = 0
    this.done = false
  }

  // One move: the first action of the best h-step plan. Ties go to the plan
  // that also scores best with fewer steps, and are otherwise broken at random.
  step(tables) {
    const best = ties(tables, tables.length - 2, this.s)
    this.s = next(this.s, best[Math.floor(this.r() * best.length)])
    this.steps++
    this.done = this.s === G
  }

  // The plan as a list of cells, for drawing. Ties take the first move.
  plan(tables) {
    const out = [this.s]
    let s = this.s
    for (let k = tables.length - 2; k >= 0 && s !== G; k--) {
      out.push((s = next(s, ties(tables, k, s)[0])))
    }
    return out
  }
}

export default function mount(fig) {
  const stage = fig.stage({ width: 8.2, target: [0, 0.2, 0], az: 0, el: 52, grid: 0 })
  const X = (i) => i - (W - 1) / 2
  const Y = (j) => j - (H - 1) / 2
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0xfbfaf7 }))
  floor.rotation.x = -Math.PI / 2
  const lines = new Segs(W + H + 2, C.grid)
  lines.begin()
  for (let i = 0; i <= W; i++) lines.add(i - W / 2, 0.005, -H / 2, i - W / 2, 0.005, H / 2)
  for (let j = 0; j <= H; j++) lines.add(-W / 2, 0.005, j - H / 2, W / 2, 0.005, j - H / 2)
  lines.end()
  stage.scene.add(floor, lines.mesh)
  const box = new THREE.BoxGeometry(1, 0.6, 1)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (wall(i, j)) stage.scene.add(at(new THREE.Mesh(box, mat(C.muted)), X(i), Y(j), 0.3))
  stage.scene.add(at(post(C.goal, 1), X(GOAL[0]), Y(GOAL[1])))
  const bot = rover(C.truth)
  const plan = new Ribbon(40, C.est, 0.14)
  stage.scene.add(bot, plan.mesh)
  stage.label('goal', 'goal').pos.set(X(GOAL[0]), 1.2, Y(GOAL[1]))
  const lPlan = stage.label('imagined rollout', 'est')

  const hor = fig.slider('imagined steps', { min: 1, max: 20, step: 1, value: 10, fmt: (v) => v })
  const val = fig.toggle('value at the end of the rollout', false)

  const run = new Run(2)
  let tables, acc, wait, reached, runs, last
  function build() {
    tables = lookahead(hor.value, val.value)
    run.reset()
    acc = wait = reached = runs = 0
    last = null
  }
  hor.on = val.on = build
  build()
  let th = 0

  stage.update = (dt) => {
    if (wait > 0) {
      wait -= dt
      if (wait <= 0) run.reset()
    } else {
      acc += dt
      while (acc >= 0.14 && wait <= 0) {
        acc -= 0.14
        const p = run.s
        run.step(tables)
        if (run.s !== p) th = Math.atan2(Math.floor(run.s / W) - Math.floor(p / W), (run.s % W) - (p % W))
        if (run.done || run.steps >= LIMIT) {
          runs++
          reached += run.done
          last = run.done ? run.steps : null
          wait = 1
        }
      }
    }
    const i = run.s % W
    const j = Math.floor(run.s / W)
    bot.setPose(X(i), Y(j), th)
    const cells = run.plan(tables).map((s) => [X(s % W), Y(Math.floor(s / W))])
    plan.set(cells.length > 1 ? cells : [], 0.05)
    lPlan.show = cells.length > 1
    const end = cells[cells.length - 1]
    lPlan.pos.set(end[0], 0.3, end[1])
    fig.readout(
      (runs ? `reached the goal in <b>${reached} of ${runs}</b> runs` : 'first run') +
        (runs ? ` · last run: ${last ? `<b class="goal">${last} steps</b>` : `<b class="meas">not reached in ${LIMIT} steps</b>`}` : ''),
    )
  }
}
