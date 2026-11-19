// Action chunks and reaction time. The policy looks at the scene, takes some
// time to compute, and then commands a chunk of actions that is played at a
// fixed rate. While a chunk plays, the robot acts on what the policy saw when
// it last looked. The target jumps at random times, and the time until the
// robot starts to respond is at most (steps per chunk + delay) action periods.

import { C, rng, rover, ball, post, at, Ribbon, Segs } from '../lib.js'

export const RATE = 50 // actions per second
const DT = 1 / RATE
const SPEED = 3.2 // m/s

export class Chunked {
  constructor(seed = 1) {
    this.r = rng(seed)
    this.n = 0
    this.p = [0, 0]
    this.target = [3, 1]
    this.seen = [...this.target] // the target as of the chunk now playing
    this.pending = null // [step at which it takes effect, target]
    this.nextJump = 60
    this.jumpAt = null
    this.react = [] // reaction time to each jump, in seconds
    this.err = 0
  }

  // k: actions executed per chunk. delay: inference time in seconds.
  step({ k, delay }) {
    const n = this.n++
    if (n >= this.nextJump) {
      this.target = [(2 * this.r() - 1) * 5.5, (2 * this.r() - 1) * 3.2]
      this.nextJump = n + 90 + Math.floor(this.r() * 110)
      this.jumpAt = n
    }
    // The policy looks once per chunk; its output arrives after the delay.
    if (n % k === 0 && !this.pending) this.pending = [n + Math.round(delay * RATE), [...this.target]]
    if (this.pending && n >= this.pending[0]) {
      if (this.jumpAt != null && (this.pending[1][0] !== this.seen[0] || this.pending[1][1] !== this.seen[1])) {
        this.react.push((n - this.jumpAt) * DT)
        if (this.react.length > 400) this.react.shift()
        this.jumpAt = null
      }
      this.seen = this.pending[1]
      this.pending = null
    }
    const dx = this.seen[0] - this.p[0]
    const dy = this.seen[1] - this.p[1]
    const d = Math.hypot(dx, dy)
    const s = Math.min(SPEED * DT, d)
    if (d > 1e-9) {
      this.p[0] += (dx / d) * s
      this.p[1] += (dy / d) * s
      this.th = Math.atan2(dy, dx)
    }
    const e = Math.hypot(this.target[0] - this.p[0], this.target[1] - this.p[1])
    this.err += (e - this.err) * 0.002
  }
}

// Longest possible time between a change in the scene and the first action that reflects it.
export const worst = (k, delay) => (k + Math.round(delay * RATE)) * DT

export default function mount(fig) {
  const stage = fig.stage({ width: 7.4, target: [0, 0.3, 0], az: 0, el: 46, grid: 20 })
  const bot = rover(C.truth)
  const goal = at(post(C.goal, 0.9), 0, 0)
  const seen = ball(C.est, 0.16)
  const line = new Segs(1, C.est)
  const trail = new Ribbon(240, C.truth, 0.06, 0.5)
  stage.scene.add(bot, goal, seen, line.mesh, trail.mesh)
  const lGoal = stage.label('target', 'goal')
  const lSeen = stage.label('target when the policy last looked', 'est')

  const k = fig.slider('actions executed per chunk', { min: 1, max: 50, step: 1, value: 25, fmt: (v) => v })
  const delay = fig.slider('inference time', { min: 0, max: 0.3, step: 0.01, value: 0.08, fmt: (v) => (v * 1000).toFixed(0) + ' ms' })

  let sim, pts, acc
  function restart() {
    sim = new Chunked(3)
    pts = []
    acc = 0
  }
  k.on = delay.on = restart
  restart()

  stage.update = (dt) => {
    acc += dt
    while (acc >= DT) {
      acc -= DT
      sim.step({ k: k.value, delay: delay.value })
      if (sim.n % 2 === 0) {
        pts.push([...sim.p])
        if (pts.length > 240) pts.shift()
      }
    }
    bot.setPose(sim.p[0], sim.p[1], sim.th || 0)
    goal.position.set(sim.target[0], 0, sim.target[1])
    const stale = sim.seen[0] !== sim.target[0] || sim.seen[1] !== sim.target[1]
    seen.visible = lSeen.show = stale
    seen.position.set(sim.seen[0], 0.16, sim.seen[1])
    line.begin()
    line.add(sim.p[0], 0.3, sim.p[1], sim.seen[0], 0.16, sim.seen[1])
    line.end()
    trail.set(pts, 0.02)
    lGoal.pos.set(sim.target[0], 1.1, sim.target[1])
    lSeen.pos.set(sim.seen[0], 0.3, sim.seen[1])
    const m = sim.react.length ? sim.react.reduce((a, b) => a + b, 0) / sim.react.length : null
    fig.readout(
      `actions at <b>${RATE} Hz</b> · looks at the scene every <b>${(k.value * DT).toFixed(2)} s</b> · slowest possible reaction: <b class="meas">${worst(k.value, delay.value).toFixed(2)} s</b>` +
        (m == null ? '' : ` · average so far: <b class="est">${m.toFixed(2)} s</b>`),
    )
  }
}
