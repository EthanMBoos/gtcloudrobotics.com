// Shared harness for lesson figures. A figure module default-exports
// `mount(fig)`; it builds a Stage, adds controls through `fig`, and sets
// `stage.update = (dt, t) => {...}`. Everything is torn down by fig.dispose().

import * as THREE from '../vendor/three.module.min.js'
import { OrbitControls } from '../vendor/OrbitControls.js'

export { THREE }

// One meaning per colour across every lesson.
export const C = {
  bg: 0xf2f1ed,
  grid: 0xdedcd5,
  truth: 0x2e2e33, // what really happened
  est: 0x3a74b8, // estimate / model prediction
  meas: 0xc0392b, // measurement / error
  goal: 0x2f8f83, // goal / good
  brass: 0xb08d3f, // odometry-only / secondary
  muted: 0x9a9aa2,
}

export const hex = (c) => '#' + c.toString(16).padStart(6, '0')
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
export const deg = Math.PI / 180

// Seeded uniform RNG with a .n() standard normal.
export function rng(seed) {
  let a = seed >>> 0
  const u = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  u.n = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u())
  return u
}

function h(tag, cls, text) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text != null) el.textContent = text
  return el
}

// ---------------------------------------------------------------- render loop

const stages = new Set()
let raf = 0
let last = 0

function loop(t) {
  raf = stages.size ? requestAnimationFrame(loop) : 0
  const dt = Math.min((t - last) / 1000, 0.05)
  last = t
  for (const s of stages) if (s.visible) s.frame(dt)
}

function start() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(loop)
}

// ---------------------------------------------------------------------- Stage

export class Stage {
  // width: half-width of the view in world units (the scene always fits
  // horizontally, whatever the aspect). rect: [x, yFromBottom, w, h] fractions.
  constructor(fig, o = {}) {
    const { width = 8, target = [0, 0, 0], az = 35, el = 32, orbit = true, grid = 20, rect = [0, 0, 1, 1] } = o
    this.fig = fig
    this.box = fig.canvasBox
    this.rect = rect
    this.halfW = width
    this.t = 0
    this.visible = true
    this.update = null
    this.insets = []
    this.labels = []

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(C.bg)
    this.dom = this.renderer.domElement
    this.box.prepend(this.dom)

    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300)
    const T = new THREE.Vector3(...target)
    const a = az * deg
    const e = el * deg
    this.camera.position.set(
      T.x + 80 * Math.cos(e) * Math.sin(a),
      T.y + 80 * Math.sin(e),
      T.z + 80 * Math.cos(e) * Math.cos(a),
    )
    this.camera.lookAt(T)
    addLights(this.scene)
    if (grid) this.scene.add(new THREE.GridHelper(grid, grid, C.grid, C.grid))

    if (orbit) {
      this.controls = new OrbitControls(this.camera, this.dom)
      this.controls.target.copy(T)
      this.controls.enableZoom = false
      this.controls.enablePan = false
      this.controls.enableDamping = true
      this.controls.maxPolarAngle = Math.PI / 2 - 0.06
      this.dom.style.touchAction = 'pan-y' // vertical swipes still scroll the page
      this.dom.style.cursor = 'grab'
    }

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.box)
    this.io = new IntersectionObserver((es) => (this.visible = es[0].isIntersecting), { rootMargin: '15% 0px' })
    this.io.observe(this.box)
    this.resize()
    stages.add(this)
    start()
  }

  resize() {
    const w = (this.w = Math.max(this.box.clientWidth, 1))
    const hh = (this.h = Math.max(this.box.clientHeight, 1))
    this.renderer.setSize(w, hh, false)
    const aspect = (w * this.rect[2]) / (hh * this.rect[3])
    const c = this.camera
    c.left = -this.halfW
    c.right = this.halfW
    c.top = this.halfW / aspect
    c.bottom = -this.halfW / aspect
    c.updateProjectionMatrix()
    for (const i of this.insets) {
      const ia = (w * i.rect[2]) / (hh * i.rect[3])
      if (i.camera.isPerspectiveCamera) i.camera.aspect = ia
      else Object.assign(i.camera, { left: -i.halfW, right: i.halfW, top: i.halfW / ia, bottom: -i.halfW / ia })
      i.camera.updateProjectionMatrix()
    }
  }

  // A second scene/camera drawn into a sub-rectangle of the same canvas.
  inset(rect, scene, camera, { bg = C.bg, halfW = 1 } = {}) {
    const i = { rect, scene, camera, bg, halfW }
    this.insets.push(i)
    this.resize()
    return i
  }

  label(text, cls = '') {
    const el = h('div', 'fig-label ' + cls, text)
    this.fig.labelBox.append(el)
    const L = { el, pos: new THREE.Vector3(), camera: null, rect: null, show: true, dy: 0 }
    this.labels.push(L)
    return L
  }

  // Fixed caption at a fractional position of the canvas (from the top left).
  tag(text, x, y) {
    const el = h('div', 'fig-tag', text)
    el.style.left = x * 100 + '%'
    el.style.top = y * 100 + '%'
    this.fig.labelBox.append(el)
    return el
  }

  viewport(rc) {
    const x = rc[0] * this.w
    const y = rc[1] * this.h
    const w = rc[2] * this.w
    const hh = rc[3] * this.h
    this.renderer.setViewport(x, y, w, hh)
    this.renderer.setScissor(x, y, w, hh)
  }

  frame(dt) {
    // Debug aid: ?warp=8 runs 8 simulated seconds before the first draw.
    if (!this.warped) {
      this.warped = true
      const n = (+new URLSearchParams(location.search).get('warp') || 0) * 60
      for (let i = 0; i < n && this.update; i++) this.update(1 / 60, (this.t += 1 / 60))
    }
    this.t += dt
    if (this.update) this.update(dt, this.t)
    if (this.controls) this.controls.update()
    const r = this.renderer
    r.setScissorTest(false)
    r.setViewport(0, 0, this.w, this.h)
    r.setClearColor(C.bg)
    r.clear()
    r.setScissorTest(true)
    this.viewport(this.rect)
    r.render(this.scene, this.camera)
    for (const i of this.insets) {
      this.viewport(i.rect)
      r.setClearColor(i.bg)
      r.clear()
      r.render(i.scene, i.camera)
    }
    const v = new THREE.Vector3()
    for (const L of this.labels) {
      const cam = L.camera || this.camera
      const rc = L.rect || this.rect
      v.copy(L.pos).project(cam)
      const ok = L.show && v.z > -1 && v.z < 1
      L.el.style.display = ok ? '' : 'none'
      if (!ok) continue
      const x = (rc[0] + (v.x * 0.5 + 0.5) * rc[2]) * this.w
      const y = this.h - (rc[1] + (v.y * 0.5 + 0.5) * rc[3]) * this.h + L.dy
      L.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-135%)`
    }
  }

  dispose() {
    stages.delete(this)
    this.ro.disconnect()
    this.io.disconnect()
    if (this.controls) this.controls.dispose()
    for (const s of [this.scene, ...this.insets.map((i) => i.scene)]) {
      s.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) for (const m of [].concat(o.material)) m.dispose()
      })
    }
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.dom.remove()
  }
}

export function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b5aa, 1.5))
  const d = new THREE.DirectionalLight(0xffffff, 1.6)
  d.position.set(6, 12, 5)
  scene.add(d)
}

// ------------------------------------------------------------------------ Fig

export class Fig {
  constructor(el) {
    this.el = el
    this.canvasBox = h('div', 'fig-canvas')
    this.labelBox = h('div', 'fig-labels')
    this.canvasBox.append(this.labelBox)
    this.extra = h('div', 'fig-extra')
    this.readoutEl = h('div', 'fig-readout')
    this.controls = h('div', 'fig-controls')
    el.prepend(this.canvasBox, this.extra, this.readoutEl, this.controls)
    this.cleanups = []
    this._readout = ''
  }

  stage(o) {
    const s = new Stage(this, o)
    this.cleanups.push(() => s.dispose())
    return s
  }

  slider(label, { min, max, step = 0.01, value, fmt = (v) => v.toFixed(2) }) {
    const wrapEl = h('label', 'fig-slider')
    const input = h('input')
    const out = h('output')
    input.type = 'range'
    Object.assign(input, { min, max, step, value })
    const s = {
      on: null,
      get value() {
        return +input.value
      },
    }
    const sync = () => (out.textContent = fmt(+input.value))
    input.addEventListener('input', () => {
      sync()
      if (s.on) s.on(+input.value)
    })
    sync()
    wrapEl.append(h('span', '', label), input, out)
    this.controls.append(wrapEl)
    return s
  }

  toggle(label, value = false) {
    const b = h('button', 'fig-btn fig-toggle', label)
    b.type = 'button'
    const s = { on: null, value }
    const sync = () => b.setAttribute('aria-pressed', s.value)
    b.addEventListener('click', () => {
      s.value = !s.value
      sync()
      if (s.on) s.on(s.value)
    })
    s.set = (v) => {
      s.value = v
      sync()
    }
    sync()
    this.controls.append(b)
    return s
  }

  button(label, fn) {
    const b = h('button', 'fig-btn', label)
    b.type = 'button'
    b.addEventListener('click', fn)
    this.controls.append(b)
    return b
  }

  // Segmented control. options: [[value, label], ...]
  choice(options, value) {
    const box = h('div', 'fig-choice')
    const s = { on: null, value }
    const btns = options.map(([v, text]) => {
      const b = h('button', 'fig-btn', text)
      b.type = 'button'
      b.addEventListener('click', () => {
        s.value = v
        sync()
        if (s.on) s.on(v)
      })
      box.append(b)
      return [v, b]
    })
    const sync = () => btns.forEach(([v, b]) => b.setAttribute('aria-pressed', v === s.value))
    sync()
    this.controls.append(box)
    return s
  }

  readout(html) {
    if (html === this._readout) return
    this._readout = html
    this.readoutEl.innerHTML = html
  }

  // Small line chart under the canvas. set(points [[x, y]...], markerX)
  chart({ xlabel = '', ylabel = '', color = C.meas } = {}) {
    const box = h('div', 'fig-chart')
    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('viewBox', '0 0 100 30')
    svg.setAttribute('preserveAspectRatio', 'none')
    const path = document.createElementNS(NS, 'path')
    const mark = document.createElementNS(NS, 'line')
    for (const p of [path, mark]) {
      p.setAttribute('fill', 'none')
      p.setAttribute('vector-effect', 'non-scaling-stroke')
    }
    path.setAttribute('stroke', hex(color))
    path.setAttribute('stroke-width', '2')
    mark.setAttribute('stroke', hex(C.truth))
    mark.setAttribute('stroke-width', '1')
    svg.append(path, mark)
    const yl = h('span', 'fig-chart-y', ylabel)
    const xl = h('span', 'fig-chart-x', xlabel)
    box.append(svg, yl, xl)
    this.extra.append(box)
    return {
      set(pts, markerX, ymax) {
        const x0 = pts[0][0]
        const x1 = pts[pts.length - 1][0]
        const top = ymax || Math.max(...pts.map((p) => p[1]), 1e-9) * 1.1
        const X = (x) => ((x - x0) / (x1 - x0 || 1)) * 100
        const Y = (y) => 29 - clamp(y / top, 0, 1) * 28
        path.setAttribute('d', pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2)).join(''))
        const mx = markerX == null ? -10 : X(markerX)
        mark.setAttribute('x1', mx)
        mark.setAttribute('x2', mx)
        mark.setAttribute('y1', 0)
        mark.setAttribute('y2', 30)
      },
      label(y, x) {
        if (y != null) yl.textContent = y
        if (x != null) xl.textContent = x
      },
    }
  }

  dispose() {
    for (const c of this.cleanups.reverse()) c()
    this.cleanups = []
  }
}

// -------------------------------------------------------------------- meshes

export const mat = (color, opacity = 1) =>
  new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })

const mesh = (geo, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  return o
}

// Ground robot, heading along +x. setPose takes planar (x, y, heading).
export function rover(color = C.truth, opacity = 1) {
  const g = new THREE.Group()
  const m = mat(color, opacity)
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.2, 0.5), m, 0, 0.24, 0))
  const nose = mesh(new THREE.ConeGeometry(0.15, 0.36, 20), m, 0.22, 0.42, 0)
  nose.rotation.z = -Math.PI / 2
  g.add(nose)
  const wheel = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 18)
  for (const [x, z] of [[0.25, 0.29], [0.25, -0.29], [-0.25, 0.29], [-0.25, -0.29]]) {
    const w = mesh(wheel, m, x, 0.13, z)
    w.rotation.x = Math.PI / 2
    g.add(w)
  }
  g.setPose = (x, y, th) => {
    g.position.set(x, 0, y)
    g.rotation.y = -th
  }
  return g
}

// Quadrotor, nose along +x, built y-up.
export function drone(color = C.truth, opacity = 1, s = 1) {
  const g = new THREE.Group()
  const m = mat(color, opacity)
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.24), m))
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), m, 0.22, 0, 0))
  const arm = new THREE.BoxGeometry(1.0, 0.035, 0.06)
  const rotor = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24)
  const rm = mat(color, 0.35 * opacity)
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const o = mesh(arm, m)
    o.rotation.y = a
    g.add(o)
  }
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(mesh(rotor, rm, x * 0.354, 0.05, z * 0.354))
  g.scale.setScalar(s)
  return g
}

export function post(color = C.truth, height = 1.1) {
  const g = new THREE.Group()
  const m = mat(color)
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, height, 16), m, 0, height / 2, 0))
  g.add(mesh(new THREE.SphereGeometry(0.14, 20, 14), m, 0, height, 0))
  return g
}

export const ball = (color, r = 0.1, opacity = 1) => new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(color, opacity))

// Flat ribbon on the ground through planar points [[x, y, (height)], ...].
export class Ribbon {
  constructor(max, color, width = 0.08, opacity = 1) {
    this.max = max
    this.half = width / 2
    this.pos = new Float32Array(max * 6)
    const idx = []
    for (let i = 0; i < max - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
    this.geo = new THREE.BufferGeometry()
    this.geo.setIndex(idx)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity >= 1 }),
    )
    this.mesh.frustumCulled = false
    this.geo.setDrawRange(0, 0)
  }

  set(pts, height = 0.03) {
    const n = Math.min(pts.length, this.max)
    const p = this.pos
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(i - 1, 0)]
      const b = pts[Math.min(i + 1, n - 1)]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const L = Math.hypot(dx, dy) || 1
      const nx = (-dy / L) * this.half
      const ny = (dx / L) * this.half
      const c = pts[i]
      const y = c[2] == null ? height : c[2]
      const k = i * 6
      p[k] = c[0] + nx
      p[k + 1] = y
      p[k + 2] = c[1] + ny
      p[k + 3] = c[0] - nx
      p[k + 4] = y
      p[k + 5] = c[1] - ny
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.setDrawRange(0, Math.max(0, (n - 1) * 6))
  }
}

// Batch of 1px line segments in 3D.
export class Segs {
  constructor(max, color, opacity = 1) {
    this.max = max
    this.pos = new Float32Array(max * 6)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.mesh = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }))
    this.mesh.frustumCulled = false
    this.n = 0
  }

  begin() {
    this.n = 0
  }

  add(x1, y1, z1, x2, y2, z2) {
    if (this.n >= this.max) return
    this.pos.set([x1, y1, z1, x2, y2, z2], this.n++ * 6)
  }

  end() {
    this.geo.attributes.position.needsUpdate = true
    this.geo.setDrawRange(0, this.n * 2)
  }
}

// k-sigma ellipse of a planar 2x2 covariance, drawn flat on the ground.
export class Ellipse {
  constructor(color, fill = 0.16) {
    this.group = new THREE.Group()
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fill, depthWrite: false, side: THREE.DoubleSide }),
    )
    const pts = []
    for (let i = 0; i <= 64; i++) pts.push(new THREE.Vector3(Math.cos((i / 64) * 2 * Math.PI), Math.sin((i / 64) * 2 * Math.PI), 0))
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }))
    const flat = new THREE.Group()
    flat.rotation.x = -Math.PI / 2
    flat.add(disc, ring)
    this.group.add(flat)
  }

  set(x, y, pxx, pxy, pyy, k = 2, height = 0.04) {
    const tr = pxx + pyy
    const d = Math.sqrt(Math.max((tr * tr) / 4 - (pxx * pyy - pxy * pxy), 0))
    const a = Math.sqrt(Math.max(tr / 2 + d, 1e-9))
    const b = Math.sqrt(Math.max(tr / 2 - d, 1e-9))
    this.group.position.set(x, height, y)
    this.group.rotation.y = -0.5 * Math.atan2(2 * pxy, pxx - pyy)
    this.group.scale.set(k * a, 1, k * b)
  }
}

// Height field over a planar rectangle. update(fn) sets height = fn(x, y);
// opacity follows height so flat regions vanish into the ground.
export class Surface {
  constructor(n, [x0, x1, y0, y1], color, opacity = 0.9) {
    this.n = n
    this.b = [x0, x1, y0, y1]
    this.opacity = opacity
    const pos = new Float32Array(n * n * 3)
    const col = new Float32Array(n * n * 4)
    const c = new THREE.Color(color)
    const idx = []
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        pos[k * 3] = lerp(x0, x1, i / (n - 1))
        pos[k * 3 + 2] = lerp(y0, y1, j / (n - 1))
        col.set([c.r, c.g, c.b, 0], k * 4)
        if (i < n - 1 && j < n - 1) idx.push(k, k + n, k + 1, k + 1, k + n, k + n + 1)
      }
    }
    this.geo = new THREE.BufferGeometry()
    this.geo.setIndex(idx)
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 4))
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    )
    this.mesh.frustumCulled = false
  }

  update(fn, full = 1) {
    const pos = this.geo.attributes.position.array
    const col = this.geo.attributes.color.array
    const m = this.n * this.n
    for (let k = 0; k < m; k++) {
      const v = fn(pos[k * 3], pos[k * 3 + 2])
      pos[k * 3 + 1] = v + 0.02
      col[k * 4 + 3] = Math.pow(clamp(v / full, 0, 1), 0.45) * this.opacity
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    this.geo.computeVertexNormals()
  }
}

// Solid arrow between two points.
const UP = new THREE.Vector3(0, 1, 0)
export class Arrow {
  constructor(color, r = 0.035, opacity = 1) {
    this.group = new THREE.Group()
    this.headLen = r * 7
    const m = mat(color, opacity)
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12).translate(0, 0.5, 0), m)
    this.head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, this.headLen, 16), m)
    this.group.add(this.shaft, this.head)
    this.d = new THREE.Vector3()
  }

  set(a, b) {
    const len = this.d.subVectors(b, a).length()
    this.group.visible = len > 1e-4
    if (!this.group.visible) return
    this.group.position.copy(a)
    this.group.quaternion.setFromUnitVectors(UP, this.d.divideScalar(len))
    const hl = Math.min(this.headLen, len * 0.6)
    this.head.scale.y = hl / this.headLen
    this.shaft.scale.y = len - hl
    this.head.position.y = len - hl / 2
  }
}

// Place an object at planar (x, y) and return it.
export const at = (o, x, y, height = 0) => {
  o.position.set(x, height, y)
  return o
}

// Soft dark disc under something that flies.
export function shadow(r = 0.3) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.13, depthWrite: false }),
  )
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.012
  return m
}

export const V = (x, y, height = 0) => new THREE.Vector3(x, height, y)
