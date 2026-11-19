// What a reconstructed scene can show. A camera was flown once along a
// straight line, facing forward. A ground cell counts as recorded if some
// camera position on that flight had it in view: within range, inside the
// field of view, and not hidden behind a parked car. A new flight to one side
// sees cells that the recording never did, and a reconstruction has nothing
// to render there. Visibility is computed by ray casting on a 25 cm grid.

import { C, THREE, rng, drone, shadow, mat, at, Ribbon } from '../lib.js'

export const NX = 64
export const NY = 40
const CELL = 0.25
const RANGE = 6.5
const FOV = (50 * Math.PI) / 180
const cx = (i) => (i - NX / 2 + 0.5) * CELL
const cy = (j) => (j - NY / 2 + 0.5) * CELL

// Occluders as [x0, x1, y0, y1]: a building front on one side of the flight,
// and scattered planters and columns on the other.
export const BOXES = [[-8, 8, -5, -1.7]]
{
  const r = rng(12)
  for (let k = 0; k < 34; k++) {
    const x = -7.8 + r() * 15
    const y = 1.2 + r() * 3.4
    BOXES.push([x, x + 0.55, y, y + 0.55])
  }
}
const inBox = (x, y) => BOXES.some((b) => x > b[0] && x < b[1] && y > b[2] && y < b[3])

function blocked(ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  for (const b of BOXES) {
    let t0 = 0
    let t1 = 1
    let hit = true
    for (const [p, d, lo, hi] of [[ax, dx, b[0], b[1]], [ay, dy, b[2], b[3]]]) {
      if (Math.abs(d) < 1e-12) {
        if (p < lo || p > hi) hit = false
      } else {
        const u = (lo - p) / d
        const v = (hi - p) / d
        t0 = Math.max(t0, Math.min(u, v))
        t1 = Math.min(t1, Math.max(u, v))
      }
    }
    if (hit && t0 < t1) return true
  }
  return false
}

// Cells in view of a forward-facing camera at (x, y). Returns a Uint8Array.
export function view(x, y) {
  const out = new Uint8Array(NX * NY)
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const dx = cx(i) - x
      const dy = cy(j) - y
      const d = Math.hypot(dx, dy)
      if (d > RANGE || d < 1e-9 || Math.abs(Math.atan2(dy, dx)) > FOV || inBox(cx(i), cy(j))) continue
      out[j * NX + i] = blocked(x, y, cx(i), cy(j)) ? 0 : 1
    }
  }
  return out
}

// Union of the views along a straight pass at lateral position y.
export function record(y, into = new Uint8Array(NX * NY)) {
  for (let x = -8; x <= 6; x += 0.5) {
    const v = view(x, y)
    for (let k = 0; k < v.length; k++) into[k] |= v[k]
  }
  return into
}

// Share of the cells in view at (x, y) that the recording contains.
export function coverage(seen, x, y) {
  if (inBox(x, y)) return null // the camera is over an obstacle
  const v = view(x, y)
  let n = 0
  let ok = 0
  for (let k = 0; k < v.length; k++) {
    if (!v[k]) continue
    n++
    ok += seen[k]
  }
  return { v, share: n ? ok / n : 1 }
}

export const SECOND = 3 // lateral position of the optional second recording

export default function mount(fig) {
  const stage = fig.stage({ width: 8, target: [0, 0.2, 0], az: 0, el: 54, grid: 0 })
  const cv = document.createElement('canvas')
  cv.width = NX
  cv.height = NY
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(NX, NY)
  const tex = new THREE.CanvasTexture(cv)
  tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(NX * CELL, NY * CELL), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
  ground.rotation.x = -Math.PI / 2
  stage.scene.add(ground)
  for (const b of BOXES) {
    const tall = b[1] - b[0] > 3
    const m = new THREE.Mesh(new THREE.BoxGeometry(b[1] - b[0], tall ? 0.9 : 0.45, b[3] - b[2]), mat(C.muted, tall ? 0.5 : 1))
    stage.scene.add(at(m, (b[0] + b[1]) / 2, (b[2] + b[3]) / 2, tall ? 0.45 : 0.225))
  }
  const rec = new Ribbon(2, C.brass, 0.08)
  rec.set([[-8, 0], [6, 0]], 0.03)
  const rec2 = new Ribbon(2, C.brass, 0.08)
  rec2.set([[-8, SECOND], [6, SECOND]], 0.03)
  const body = drone(C.truth, 1, 1.2)
  const shade = shadow(0.36)
  stage.scene.add(rec.mesh, rec2.mesh, body, shade)
  stage.label('recorded flight', 'brass').pos.set(-6.6, 0.2, 0)
  const lNew = stage.label('new flight')

  const off = fig.slider('distance from the recorded flight', { min: 0, max: 3.6, step: 0.1, value: 2.6, fmt: (v) => v.toFixed(1) + ' m' })
  const two = fig.toggle('record a second flight on this side', false)

  const one = record(0)
  const both = record(SECOND, one.slice())
  const COL = { base: [0xfb, 0xfa, 0xf7], seen: [0xdc, 0xe6, 0xf2], ok: [0x6f, 0x9c, 0xd0], hole: [0xd8, 0x6f, 0x62] }
  let x = -7
  let sum = 0
  let n = 0
  let avg = null
  off.on = two.on = () => {
    sum = n = 0
    avg = null
  }

  stage.update = (dt) => {
    x += 1.6 * dt
    if (x > 2) {
      x = -7
      avg = sum / n
      sum = n = 0
    }
    const seen = two.value ? both : one
    rec2.mesh.visible = two.value
    body.position.set(x, 1.2, off.value)
    shade.position.set(x, 0.012, off.value)
    lNew.pos.set(x, 1.5, off.value)
    const c = coverage(seen, x, off.value)
    if (!c) return
    const { v, share } = c
    sum += share
    n++
    for (let k = 0; k < v.length; k++) {
      const c = v[k] ? (seen[k] ? COL.ok : COL.hole) : seen[k] ? COL.seen : COL.base
      img.data.set([c[0], c[1], c[2], 255], k * 4)
    }
    ctx.putImageData(img, 0, 0)
    tex.needsUpdate = true
    fig.readout(
      `of the ground in view now, <b class="est">${(share * 100).toFixed(0)}%</b> was recorded` +
        (avg == null ? '' : ` · over the last pass: <b class="est">${(avg * 100).toFixed(0)}%</b>`),
    )
  }
  fig.cleanups.push(() => tex.dispose())
}
