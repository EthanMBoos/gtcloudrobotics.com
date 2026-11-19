// A drone following a rover, commanded two ways. Either the slow LLM picks
// a skill and a fast layer tracks the rover, or the LLM sends every position
// setpoint itself and the drone chases where the rover used to be.

import { C, hex, drone, rover, shadow, ball, Ribbon, clamp } from '../lib.js'
import { ALT } from './world.js'

const H = 1 / 250
const WINDOW = 4 // seconds shown in the timeline
const target = (u) => [4.6 * Math.sin(u), 2.8 * Math.sin(2 * u + 0.6)]

export default function mount(fig) {
  const stage = fig.stage({ width: 6.6, target: [0, 0.6, 0], az: 0, el: 40, grid: 16 })
  const car = rover(C.brass)
  const craft = drone(C.truth, 1, 1.2)
  const shade = shadow(0.4)
  const mark = ball(C.est, 0.12)
  const trail = new Ribbon(400, C.truth, 0.04, 0.5)
  stage.scene.add(car, craft, shade, mark, trail.mesh)
  const lCmd = stage.label('', 'est')
  const lSp = stage.label('setpoint', 'est')

  const mode = fig.choice([['skill', 'LLM picks the skill'], ['steer', 'LLM sends every setpoint']], 'skill')
  const speed = fig.slider('rover speed', { min: 0.4, max: 3, step: 0.1, value: 1.4, fmt: (v) => v.toFixed(1) + ' m/s' })
  const lat = fig.slider('LLM latency', { min: 0.2, max: 2, step: 0.1, value: 0.8, fmt: (v) => v.toFixed(1) + ' s' })

  const strip = document.createElement('canvas')
  strip.className = 'fig-strip'
  fig.extra.append(strip)
  const ctx = strip.getContext('2d')

  let t = 0
  let u = 0
  let p = [0, 0]
  let v = [0, 0]
  let sp = [0, 0]
  let spv = [0, 0]
  let following = false
  let pending = null
  let nextObs = 0
  let nextSkill = 0
  let calls = []
  let miss = 0
  let acc = 0
  let k = 0
  let pts = []
  let prev = target(0)

  mode.on = () => {
    following = false
    spv = [0, 0]
  }

  function tick() {
    t += H
    const a = target(u)
    const b = target(u + 1e-3)
    u += (speed.value * H) / (Math.hypot(b[0] - a[0], b[1] - a[1]) / 1e-3)
    const g = target(u)
    const gv = [(g[0] - prev[0]) / H, (g[1] - prev[1]) / H]
    prev = g

    // LLM: look, think for `latency`, then act. At most about one call a second.
    if (!pending && t >= nextObs) {
      pending = { t0: t, t1: t + lat.value, seen: [...g] }
      nextObs = t + Math.max(1, lat.value)
      calls.push(pending)
      if (calls.length > 12) calls.shift()
    }
    if (pending && t >= pending.t1) {
      if (mode.value === 'steer') {
        sp = pending.seen
        spv = [0, 0]
        lCmd.el.textContent = `goto(${sp[0].toFixed(1)}, ${sp[1].toFixed(1)})`
      } else {
        following = true
        lCmd.el.textContent = 'follow(rover)'
      }
      pending = null
    }
    // Skill layer, 20 Hz: tracks the rover from its own camera.
    if (mode.value === 'skill' && following && t >= nextSkill) {
      nextSkill = t + 0.05
      sp = [...g]
      spv = gv
    }
    // Position controller.
    for (let i = 0; i < 2; i++) {
      const acc2 = clamp(30 * (sp[i] - p[i]) + 10 * (spv[i] - v[i]), -9, 9)
      v[i] += acc2 * H
      p[i] += v[i] * H
    }
    miss += (Math.hypot(p[0] - g[0], p[1] - g[1]) - miss) * 0.0015
    if (k++ % 10 === 0) {
      pts.push([p[0], p[1]])
      if (pts.length > 400) pts.shift()
    }
    return g
  }

  function drawStrip() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = strip.clientWidth
    const hh = strip.clientHeight
    if (strip.width !== Math.round(w * dpr)) {
      strip.width = Math.round(w * dpr)
      strip.height = Math.round(hh * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, hh)
    const left = 132
    const row = hh / 3
    const X = (time) => left + (1 - (t - time) / WINDOW) * (w - left)
    const steer = mode.value === 'steer'
    ctx.font = '12px system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    const rows = [['LLM, about 1 Hz', C.meas], ['skill model, 20 Hz', C.est], ['attitude loop, 250 Hz', C.truth]]
    rows.forEach(([name, c], i) => {
      ctx.globalAlpha = i === 1 && steer ? 0.3 : 1
      ctx.fillStyle = hex(C.truth)
      ctx.fillText(i === 1 && steer ? 'skill model, bypassed' : name, 0, row * (i + 0.5))
      ctx.fillStyle = hex(c)
      const y = row * i + 5
      const bh = row - 10
      if (i === 0) {
        for (const cl of calls) {
          const x0 = Math.max(X(cl.t0), left)
          const x1 = Math.min(X(Math.min(cl.t1, t)), w)
          if (x1 <= left) continue
          ctx.globalAlpha = 0.25
          ctx.fillRect(x0, y, x1 - x0, bh)
          ctx.globalAlpha = 1
          if (cl.t1 <= t && X(cl.t1) > left) ctx.fillRect(X(cl.t1) - 1.5, y, 3, bh)
        }
      } else {
        const period = i === 1 ? 0.05 : H
        if (i === 1 && (steer || !following)) return
        for (let time = Math.floor(t / period) * period; time > t - WINDOW; time -= period) ctx.fillRect(X(time), y, 1, bh)
      }
    })
    ctx.globalAlpha = 1
  }

  stage.update = (dt) => {
    acc += dt
    let g = prev
    while (acc > H) {
      acc -= H
      g = tick()
    }
    const g2 = target(u + 0.01)
    car.setPose(g[0], g[1], Math.atan2(g2[1] - g[1], g2[0] - g[0]))
    craft.position.set(p[0], ALT, p[1])
    shade.position.set(p[0], 0.012, p[1])
    mark.position.set(sp[0], 0.12, sp[1])
    trail.set(pts, ALT)
    lCmd.pos.set(p[0], ALT + 0.45, p[1])
    lSp.pos.set(sp[0], 0.2, sp[1])
    lSp.dy = 40
    lSp.show = mode.value === 'steer'
    drawStrip()
    fig.readout(`drone is on average <b class="meas">${miss.toFixed(2)} m</b> from the rover`)
  }
}
