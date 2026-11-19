// Localizing against a prior map. The car has a stored map of how bright the
// road surface is. Its satellite and inertial position is off by a slowly
// changing amount. A histogram filter holds a belief over that offset and, on
// each lidar scan, raises the offsets at which the scan lines up with the map.

import { C, THREE, rng, rover, Surface, addLights } from '../lib.js'

const PERIOD = 18 // m; the map repeats along the road
export const G = 17 // offset cells per side
export const CELL = 0.15 // m
const HALF = ((G - 1) / 2) * CELL
const NOISE = 0.12
const MAIN = [0, 0, 0.62, 1]
const INSET = [0.64, 0.24, 0.34, 0.56]

const bump = (d, w) => Math.exp(-((d / w) ** 2))
const edge = (v) => 1 / (1 + Math.exp(-v / 0.08))

// Road brightness in [0, 1]: two edge lines and a center line, dashed or solid.
export function refl(x, y, dashed) {
  let v = Math.abs(y) > 2.5 ? 0.42 : 0.25
  v = Math.max(v, 0.25 + 0.65 * bump(Math.abs(y) - 1.9, 0.14))
  const xm = ((x % 4.5) + 4.5) % 4.5
  const on = dashed ? edge(xm - 0.3) * edge(1.8 - xm) : 1
  return Math.max(v, 0.25 + 0.65 * on * bump(y, 0.14))
}

// Scan pattern: points on the ground within 3 m of the car.
export const PATTERN = []
for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) if (i * i + j * j <= 144) PATTERN.push([i * 0.25, j * 0.25])

export class MapLoc {
  constructor(seed = 1) {
    this.r = rng(seed)
    this.t = 0
    this.x = 0
    this.p = new Float32Array(G * G).fill(1 / (G * G))
    this.gpsErr = [0, 0]
    this.mean = [0, 0]
    this.scan = new Float32Array(PATTERN.length)
  }

  // Advance by dt and take one scan. size = how far off the satellite fix gets.
  step(dt, { speed, size, dashed }) {
    const r = this.r
    this.t += dt
    this.x += speed * dt
    this.gpsErr = [size * Math.sin(0.23 * this.t + 1), size * 0.8 * Math.cos(0.17 * this.t)]
    const gps = [this.x + this.gpsErr[0], this.gpsErr[1]]
    PATTERN.forEach((q, i) => (this.scan[i] = refl(this.x + q[0], q[1], dashed) + NOISE * r.n()))

    // Predict: the offset may have changed a little, so blur the belief.
    const p = this.p
    const b = new Float32Array(G * G)
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        let s = 0
        let n = 0
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const a = i + di
            const c = j + dj
            if (a < 0 || c < 0 || a >= G || c >= G) continue
            const w = di || dj ? 1 : 4
            s += w * p[c * G + a]
            n += w
          }
        }
        b[j * G + i] = s / n + 2e-4
      }
    }
    // Update: score every offset by how well the scan matches the map there.
    const ll = new Float32Array(G * G)
    let top = -Infinity
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const ox = i * CELL - HALF
        const oy = j * CELL - HALF
        let s = 0
        for (let k = 0; k < PATTERN.length; k++) {
          const d = this.scan[k] - refl(gps[0] - ox + PATTERN[k][0], gps[1] - oy + PATTERN[k][1], dashed)
          s += d * d
        }
        ll[j * G + i] = -s / (2 * NOISE * NOISE * 12) // tempered: neighboring points are not independent
        top = Math.max(top, ll[j * G + i])
      }
    }
    let sum = 0
    for (let k = 0; k < G * G; k++) sum += p[k] = b[k] * Math.exp(ll[k] - top)
    let mx = 0
    let my = 0
    for (let k = 0; k < G * G; k++) {
      p[k] /= sum
      mx += p[k] * ((k % G) * CELL - HALF)
      my += p[k] * (Math.floor(k / G) * CELL - HALF)
    }
    this.mean = [mx, my]
  }

  // Position error [along road, lateral] of the raw fix and of the corrected one.
  errors() {
    return { gps: this.gpsErr, est: [this.gpsErr[0] - this.mean[0], this.gpsErr[1] - this.mean[1]] }
  }
}

function roadTexture(dashed) {
  const W = 720
  const H = 320
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(W, H)
  const lo = [0xc9, 0xc6, 0xbd]
  const hi = [0xff, 0xfe, 0xfa]
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const v = (refl((i / W) * PERIOD, (j / H) * 8 - 4, dashed) - 0.25) / 0.65
      const k = (j * W + i) * 4
      for (let c = 0; c < 3; c++) img.data[k + c] = lo[c] + (hi[c] - lo[c]) * Math.min(Math.max(v, 0), 1)
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(2, 1)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function mount(fig) {
  const stage = fig.stage({ width: 5.2, target: [0, 0.2, 0], az: 0, el: 50, grid: 0, rect: MAIN })
  const tex = { true: roadTexture(true), false: roadTexture(false) }
  const road = new THREE.Mesh(new THREE.PlaneGeometry(2 * PERIOD, 8), new THREE.MeshBasicMaterial({ map: tex.true }))
  road.rotation.x = -Math.PI / 2
  road.scale.y = -1 // image rows run with +y of the sim
  road.material.side = THREE.DoubleSide
  const truth = rover(C.truth)
  const gpsBot = rover(C.brass, 0.7)
  const estBot = rover(C.est, 0.85)
  const ptsGeo = new THREE.BufferGeometry()
  ptsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PATTERN.flatMap((q) => [q[0], 0.03, q[1]])), 3))
  const ptsCol = new Float32Array(PATTERN.length * 3)
  ptsGeo.setAttribute('color', new THREE.BufferAttribute(ptsCol, 3))
  const pts = new THREE.Points(ptsGeo, new THREE.PointsMaterial({ size: 3.5, sizeAttenuation: false, vertexColors: true }))
  stage.scene.add(road, truth, gpsBot, estBot, pts)
  const lGps = stage.label('satellite + inertial', 'brass')
  const lEst = stage.label('matched to the map', 'est')

  // Inset: the belief over the offset, as a surface.
  const scene = new THREE.Scene()
  addLights(scene)
  const surf = new Surface(G, [-HALF, HALF, -HALF, HALF], C.est, 0.95)
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * HALF, 0.001, 2 * HALF)),
    new THREE.LineBasicMaterial({ color: C.muted }),
  )
  scene.add(surf.mesh, frame)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50)
  cam.position.set(0, 4.6, 5)
  cam.lookAt(0, 0.25, 0)
  stage.inset(INSET, scene, cam, { bg: 0xfbfaf7, halfW: 1.75 })
  stage.tag('belief over the position offset', 0.64, 0.14)
  stage.tag('← along the road →', 0.72, 0.76)

  const dashed = fig.toggle('dashed center line', true)
  const size = fig.slider('satellite error', { min: 0.1, max: 1, step: 0.05, value: 0.7, fmt: (v) => v.toFixed(2) + ' m' })
  const speed = fig.slider('speed', { min: 1, max: 12, step: 0.5, value: 5, fmt: (v) => v.toFixed(1) + ' m/s' })
  dashed.on = (v) => {
    road.material.map = tex[v]
    road.material.needsUpdate = true
  }

  const sim = new MapLoc(3)
  let acc = 0
  const pale = new THREE.Color(0xe7b9b2)
  const red = new THREE.Color(C.meas)
  const col = new THREE.Color()
  const rms = { g: [0, 0], e: [0, 0], n: 0 }

  stage.update = (dt) => {
    acc += dt
    if (acc >= 0.1) {
      sim.step(acc, { speed: speed.value, size: size.value, dashed: dashed.value })
      acc = 0
      let top = 0
      for (const v of sim.p) top = Math.max(top, v)
      surf.update((x, y) => {
        const i = Math.round((x + HALF) / CELL)
        const j = Math.round((y + HALF) / CELL)
        return (sim.p[j * G + i] / top) * 1.1
      }, 1.1)
      for (let k = 0; k < PATTERN.length; k++) {
        col.lerpColors(pale, red, Math.min(Math.max((sim.scan[k] - 0.25) / 0.65, 0), 1))
        ptsCol.set([col.r, col.g, col.b], k * 3)
      }
      ptsGeo.attributes.color.needsUpdate = true
      const e = sim.errors()
      const a = 0.02
      rms.n++
      for (let k = 0; k < 2; k++) {
        rms.g[k] += (e.gps[k] ** 2 - rms.g[k]) * Math.max(a, 1 / rms.n)
        rms.e[k] += (e.est[k] ** 2 - rms.e[k]) * Math.max(a, 1 / rms.n)
      }
    }
    // The camera rides with the car, so the road scrolls underneath.
    road.material.map.offset.x = ((sim.x + acc * speed.value) % PERIOD) / PERIOD
    const e = sim.errors()
    truth.setPose(0, 0, 0)
    gpsBot.setPose(e.gps[0], e.gps[1], 0)
    estBot.setPose(e.est[0], e.est[1], 0)
    lGps.pos.set(e.gps[0], 0.7, e.gps[1])
    lEst.pos.set(e.est[0], 0.7, e.est[1])
    lEst.dy = 58
    const cm = (v) => (Math.sqrt(v) * 100).toFixed(0)
    fig.readout(
      `sideways error: <b class="brass">${cm(rms.g[1])} cm</b> → <b class="est">${cm(rms.e[1])} cm</b> · ` +
        `along the road: <b class="brass">${cm(rms.g[0])} cm</b> → <b class="est">${cm(rms.e[0])} cm</b> RMS`,
    )
  }
  fig.cleanups.push(() => {
    tex.true.dispose()
    tex.false.dispose()
  })
}
