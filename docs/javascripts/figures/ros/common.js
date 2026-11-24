// Builds a ROS figure: the room with the robot in it, optionally a second
// pane that draws only what the topics carry, a table of the graph, and a
// terminal. The figure modules next to this file only choose the options.
//
// The sim uses ROS axes (x forward, y left, counter-clockwise positive), so
// planar (x, y) goes to three.js (x, height, -y) here, unlike the other figures.

import { C, THREE, rng, rover, mat, Ribbon, Segs, Arrow } from '../lib.js'
import { World, Graph, Tf, ROOM, BOXES, BEAMS, SCAN, TWIST } from './ros.js'
import { terminal } from './term.js'

const P = (x, y, hgt = 0) => new THREE.Vector3(x, hgt, -y)
const LEFT = [0, 0, 0.5, 1]
const RIGHT = [0.5, 0, 0.5, 1]
const DECAY = 4 // seconds a scan stays in the right-hand pane
const SHOWN = ['/scan', '/cmd_vel'] // /tf is left out until the page gets to frames

function points(max, size, opacity = 1) {
  const pos = new Float32Array(max * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setDrawRange(0, 0)
  const m = new THREE.Points(geo, new THREE.PointsMaterial({ color: C.meas, size, sizeAttenuation: false, transparent: opacity < 1, opacity }))
  m.frustumCulled = false
  return { mesh: m, pos, geo }
}

function floor(scene, w, d, step = 1) {
  const g = new Segs(64, C.grid)
  g.begin()
  for (let x = -w / 2; x <= w / 2 + 1e-6; x += step) g.add(x, 0, -d / 2, x, 0, d / 2)
  for (let y = -d / 2; y <= d / 2 + 1e-6; y += step) g.add(-w / 2, 0, y, w / 2, 0, y)
  g.end()
  scene.add(g.mesh)
}

function triad(len = 0.7) {
  const g = new THREE.Group()
  const axes = [[0xc0392b, P(len, 0, 0)], [0x3f9a55, P(0, len, 0)], [0x3a74b8, P(0, 0, len)]]
  for (const [color, tip] of axes) {
    const a = new Arrow(color, 0.028)
    a.set(P(0, 0, 0.02), tip.add(P(0, 0, 0.02)))
    g.add(a.group)
  }
  return g
}

const place = (o, T) => {
  o.position.set(T.x, 0, -T.y)
  o.rotation.y = T.yaw
}

// The graph, drawn above the scene the way rqt_graph draws it: a pill per
// node and an arrow per topic, from each publisher to each subscriber. A topic
// with nobody on one end gets an arrow to or from a grey note.
function graphStrip(fig, g) {
  const el = document.createElement('div')
  el.className = 'fig-graph'
  fig.canvasBox.before(el)
  const H = 70
  let html = ''
  let next = 0
  return () => {
    if (g.t < next) return
    next = g.t + 0.25
    const W = el.clientWidth || 600
    const items = new Map() // key -> { text, kind, layer }
    const edges = new Map() // "from>to" -> { a, b, labels, on }
    const item = (key, text, kind) => {
      if (!items.has(key)) items.set(key, { text, kind, layer: 0 })
      return key
    }
    const real = (e) => item(e.node.name, e.node.label || e.node.name, e.node.kind)
    for (const name of SHOWN) {
      const t = g.topics.get(name)
      if (!t) continue
      const hz = g.rate(t)
      const vis = (set) => [...set].filter((e) => e.node.kind !== 'hidden')
      const pubs = vis(t.pubs).map(real)
      const subs = vis(t.subs).map(real)
      if (!pubs.length && !subs.length) continue
      const from = pubs.length ? pubs : [item('in:' + name, 'no publisher', 'none')]
      const to = subs.length ? subs : [item('out:' + pubs[0], 'no subscriber', 'none')]
      for (const a of from) {
        for (const b of to) {
          const k = a + '>' + b
          if (!edges.has(k)) edges.set(k, { a, b, labels: [], on: false })
          const e = edges.get(k)
          if (b === to[0]) e.labels.push(name + (W > 520 ? (hz ? ` ${hz.toFixed(0)} Hz` : ' silent') : ''))
          e.on = e.on || hz > 0
        }
      }
    }
    for (let pass = 0; pass < items.size; pass++) {
      for (const e of edges.values()) items.get(e.b).layer = Math.max(items.get(e.b).layer, Math.min(items.get(e.a).layer + 1, 5))
    }
    const cols = []
    for (const it of items.values()) (cols[it.layer] = cols[it.layer] || []).push(it)
    const n = cols.length
    cols.forEach((col, i) => {
      const gap = Math.min(26, (H - 24) / Math.max(col.length - 1, 1))
      col.forEach((it, r) => {
        it.w = it.text.length * 6.1 + (it.kind === 'none' ? 0 : 18)
        it.y = H / 2 + (r - (col.length - 1) / 2) * gap
        const cx = n > 1 ? (i / (n - 1)) * W : W / 2
        it.x0 = i === 0 ? 1 : i === n - 1 ? W - 1 - it.w : cx - it.w / 2
      })
    })
    let out = ''
    for (const e of edges.values()) {
      const a = items.get(e.a)
      const b = items.get(e.b)
      const [x1, x2] = [a.x0 + a.w + 5, b.x0 - 7]
      out += `<line class="${e.on ? 'on' : ''}" x1="${x1}" y1="${a.y}" x2="${x2}" y2="${b.y}" marker-end="url(#fig-graph-tip${e.on ? '-on' : ''})"/>`
      e.labels.forEach((l, i) => {
        out += `<text class="topic${e.on ? ' on' : ''}" x="${(x1 + x2) / 2}" y="${(a.y + b.y) / 2 + (i ? 13 * i + 2 : -6)}">${l}</text>`
      })
    }
    for (const it of items.values()) {
      if (it.kind !== 'none') out += `<rect class="${it.kind}" x="${it.x0}" y="${it.y - 10}" width="${it.w}" height="20" rx="10"/>`
      out += `<text class="${it.kind}" x="${it.x0 + it.w / 2}" y="${it.y + 4}">${it.text}</text>`
    }
    if (out === html) return
    html = out
    const tip = (id) => `<marker id="${id}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L7 4 L1 7"/></marker>`
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}"><defs>${tip('fig-graph-tip')}${tip('fig-graph-tip-on')}</defs>${out}</svg>`
  }
}

export function rosFig(fig, o = {}) {
  const { nodes = ['lidar', 'base'], viz = false, table = false, term = true, commands = [], toggles = false, power = false, fixed = false } = o
  fig.el.classList.add('fig-ros')
  const rand = rng(11)
  const world = new World(rand)
  const g = new Graph(world, rand)
  const up = () => nodes.forEach((n) => g.find(n) || g.launch(n))
  up()

  const stage = fig.stage({ width: viz ? 5.7 : 7.4, az: 0, el: 55, grid: 0, rect: viz ? LEFT : [0, 0, 1, 1] })
  const scene = stage.scene
  floor(scene, ...ROOM)
  const wall = mat(C.muted)
  for (const [x, y, w, d] of [[0, ROOM[1] / 2, ROOM[0] + 0.1, 0.1], [0, -ROOM[1] / 2, ROOM[0] + 0.1, 0.1], [ROOM[0] / 2, 0, 0.1, ROOM[1]], [-ROOM[0] / 2, 0, 0.1, ROOM[1]]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), wall)
    m.position.copy(P(x, y, 0.175))
    scene.add(m)
  }
  const crate = mat(0xcfccc3)
  for (const [x, y, w, d] of BOXES) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), crate)
    m.position.copy(P(x, y, 0.3))
    scene.add(m)
  }
  const bot = rover(C.truth)
  const rays = new Segs(BEAMS, C.meas, 0.13)
  const hits = points(BEAMS, 3.5)
  const trail = new Ribbon(500, C.truth, 0.05, 0.3)
  const plan = new Ribbon(24, C.goal, 0.09)
  scene.add(bot, rays.mesh, hits.mesh, trail.mesh, plan.mesh)

  // What the left pane draws of the topics: the latest scan and command.
  const eye = g.node('display', 'hidden')
  let scan = null
  let cmd = null
  eye.sub('/scan', SCAN, (m) => (scan = { m, t: g.t, x: world.x, y: world.y, th: world.th }))
  eye.sub('/cmd_vel', TWIST, (m) => (cmd = { m, t: g.t }))

  function drawScan() {
    const live = scan && g.t - scan.t < 0.3 && g.find('lidar') // a replayed scan was not taken from here
    rays.begin()
    let n = 0
    if (live) {
      scan.m.ranges.forEach((r, i) => {
        if (!Number.isFinite(r)) return
        const a = scan.th + scan.m.angle_min + i * ((2 * Math.PI) / scan.m.ranges.length)
        const hx = scan.x + r * Math.cos(a)
        const hy = scan.y + r * Math.sin(a)
        rays.add(scan.x, 0.3, -scan.y, hx, 0.3, -hy)
        hits.pos.set([hx, 0.3, -hy], 3 * n++)
      })
    }
    rays.end()
    hits.geo.attributes.position.needsUpdate = true
    hits.geo.setDrawRange(0, n)
  }

  // Where the last command would take the robot over the next two seconds.
  function drawPlan() {
    const live = cmd && g.t - cmd.t < 0.3 && g.find('base') && (cmd.m.linear.x || cmd.m.angular.z)
    plan.mesh.visible = !!live
    if (!live) return
    let [x, y, th] = [world.x, world.y, world.th]
    const pts = []
    for (let i = 0; i < 24; i++) {
      pts.push([x, -y])
      th += (cmd.m.angular.z * 2) / 24
      x += ((cmd.m.linear.x * 2) / 24) * Math.cos(th)
      y += ((cmd.m.linear.x * 2) / 24) * Math.sin(th)
    }
    plan.set(pts, 0.05)
  }

  const path = []
  let since = 0

  // ---- right pane: only what is on the topics, placed with /tf
  let drawViz = () => {}
  if (viz) {
    const vs = new THREE.Scene()
    vs.add(new THREE.HemisphereLight(0xffffff, 0xb9b5aa, 2.4))
    floor(vs, 16, 16)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300)
    stage.inset(RIGHT, vs, cam, { bg: 0xfbfaf7, halfW: 5.7 })
    const cloud = points(BEAMS * 45, 2.5, 0.75)
    const ghost = rover(C.est)
    const frames = { odom: triad(), base_link: triad(0.5) }
    vs.add(cloud.mesh, ghost, frames.odom, frames.base_link)
    const labels = Object.keys(frames).map((k) => Object.assign(stage.label(k), { camera: cam, rect: RIGHT, dy: 26 }))
    stage.tag('the room', 0.01, 0)
    stage.tag('what the topics carry', 0.51, 0)
    const warn = stage.tag('', 0.51, 0.06)
    warn.classList.add('meas')
    const rule = stage.tag('', 0.5, 0)
    rule.classList.add('fig-rule')

    const frame = fixed ? fig.choice([['odom', 'fixed frame: odom'], ['base_link', 'fixed frame: base_link']], 'odom') : { value: 'odom' }
    const node = g.node('viz', 'hidden')
    const tf = new Tf(node)
    let scans = []
    let lost = ''
    frame.on = () => (scans = [])
    node.sub('/scan', SCAN, (m) => {
      const T = tf.lookup(frame.value, m.header.frame_id)
      lost = T ? '' : `no transform from ${m.header.frame_id} to ${frame.value}`
      if (!T) return
      const pts = []
      m.ranges.forEach((r, i) => {
        if (!Number.isFinite(r)) return
        const a = T.yaw + m.angle_min + i * m.angle_increment
        pts.push(T.x + r * Math.cos(a), 0.05, -(T.y + r * Math.sin(a)))
      })
      scans.push({ t: g.t, pts })
    })

    drawViz = () => {
      cam.position.copy(stage.camera.position)
      cam.quaternion.copy(stage.camera.quaternion)
      scans = scans.filter((s) => g.t - s.t < DECAY).slice(-45)
      let n = 0
      for (const s of scans) {
        cloud.pos.set(s.pts, n)
        n += s.pts.length
      }
      cloud.geo.attributes.position.needsUpdate = true
      cloud.geo.setDrawRange(0, n / 3)
      const B = tf.lookup(frame.value, 'base_link')
      const O = tf.lookup(frame.value, 'odom')
      ghost.visible = frames.base_link.visible = labels[1].show = !!B
      frames.odom.visible = labels[0].show = !!O
      if (B) {
        place(ghost, B)
        place(frames.base_link, B)
        labels[1].pos.copy(P(B.x, B.y))
      }
      if (O) {
        place(frames.odom, O)
        labels[0].pos.copy(P(O.x, O.y))
      }
      const stale = scans.length ? '' : 'nothing on /scan'
      warn.textContent = lost && !scans.length ? lost : stale
    }
  }

  // ---- controls
  if (toggles) {
    for (const name of nodes) {
      fig.toggle(name, true).on = (v) => (v ? g.launch(name) : g.find(name).destroy())
    }
  }
  if (power) {
    fig.toggle('robot power', true).on = (v) => (v ? up() : nodes.forEach((n) => g.find(n) && g.find(n).destroy()))
  }

  const drawGraph = table ? graphStrip(fig, g) : () => {}

  const tty = term ? terminal(fig, g, { commands }) : null

  stage.update = (dt) => {
    g.step(dt)
    world.step(dt)
    bot.setPose(world.x, -world.y, -world.th)
    if ((since += dt) > 0.1) {
      since = 0
      const last = path[path.length - 1]
      if (last && Math.hypot(world.x - last[0], -world.y - last[1]) > 2) path.length = 0 // reset teleports
      path.push([world.x, -world.y])
      if (path.length > 500) path.shift()
      trail.set(path, 0.02)
    }
    drawScan()
    drawPlan()
    drawViz()
    drawGraph()
    if (tty) tty.flush()
  }
}
