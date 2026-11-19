// A camera frame becomes a point. The drone's view is rendered at 16 x 12,
// and those 576 numbers are squeezed to 3 by a fixed random projection. A
// trained encoder does the same job with learned weights; this one is only
// here so the picture is real rather than drawn.

import { C, THREE, rng, drone, mat, addLights, ball } from '../lib.js'

const PW = 16
const PH = 12
const SAMPLES = 180
const MAIN = [0, 0, 0.6, 1]
const VIEW = [0.63, 0.53, 0.35, 0.42]
const LATENT = [0.63, 0.04, 0.35, 0.42]

export default function mount(fig) {
  const stage = fig.stage({ width: 5.4, target: [0, 0.7, 0], az: 25, el: 30, grid: 14, rect: MAIN })
  const add = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(x, y, z)
    stage.scene.add(m)
  }
  add(new THREE.BoxGeometry(1, 1, 1), C.meas, 1.7, 0.5, 0.9)
  add(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 28), C.goal, -1.8, 0.8, -1.2)
  add(new THREE.ConeGeometry(0.6, 1.3, 28), C.brass, 0.6, 0.65, -1.9)
  add(new THREE.BoxGeometry(0.7, 2, 0.7), C.est, -1.3, 1, 1.6)
  add(new THREE.SphereGeometry(0.45, 28, 18), C.truth, 0, 0.45, 0)

  const craft = drone(C.truth, 1, 1.2)
  craft.traverse((o) => o.layers.set(1)) // the drone's own camera shouldn't see the drone
  stage.camera.layers.enable(1)
  stage.scene.add(craft)

  const eye = new THREE.PerspectiveCamera(62, PW / PH, 0.1, 60)
  const rt = new THREE.WebGLRenderTarget(PW, PH)
  rt.texture.magFilter = THREE.NearestFilter
  rt.texture.minFilter = THREE.NearestFilter
  const px = new Uint8Array(PW * PH * 4)

  // Inset 1: the 16 x 12 frame, as the encoder gets it.
  const viewScene = new THREE.Scene()
  viewScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), new THREE.MeshBasicMaterial({ map: rt.texture })))
  const viewCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)
  stage.inset(VIEW, viewScene, viewCam, { bg: 0xfbfaf7, halfW: 1.06 })

  // Inset 2: latent space.
  const zScene = new THREE.Scene()
  addLights(zScene)
  zScene.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)), new THREE.LineBasicMaterial({ color: C.grid })))
  const curvePos = new Float32Array(SAMPLES * 3)
  const curveGeo = new THREE.BufferGeometry()
  curveGeo.setAttribute('position', new THREE.BufferAttribute(curvePos, 3))
  zScene.add(new THREE.LineLoop(curveGeo, new THREE.LineBasicMaterial({ color: C.est })))
  const dot = ball(C.truth, 0.09)
  zScene.add(dot)
  const zCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50)
  stage.inset(LATENT, zScene, zCam, { bg: 0xfbfaf7, halfW: 1.6 })

  stage.tag('what the encoder sees: 16 × 12 pixels', 0.63, 0.02)
  stage.tag('latent: 3 numbers', 0.63, 0.51)

  const radius = fig.slider('orbit radius', { min: 2.8, max: 5, step: 0.1, value: 3.8, fmt: (v) => v.toFixed(1) + ' m' })
  const height = fig.slider('height', { min: 0.8, max: 3, step: 0.1, value: 1.6, fmt: (v) => v.toFixed(1) + ' m' })

  const r = rng(77)
  // Random but spatially smooth weights, so a one-pixel shift moves z a little.
  const Wp = new Float32Array(3 * PW * PH * 3)
  for (let d = 0; d < 3; d++) {
    for (let c = 0; c < 3; c++) {
      const waves = Array.from({ length: 3 }, () => [r.n() * 0.3, r.n() * 0.3, r() * 6.283, r.n()])
      for (let i = 0; i < PW * PH; i++) {
        const x = i % PW
        const y = Math.floor(i / PW)
        Wp[(i * 3 + c) * 3 + d] = waves.reduce((a, w) => a + w[3] * Math.cos(w[0] * x + w[1] * y + w[2]), 0)
      }
    }
  }
  const look = new THREE.Vector3(0, 0.6, 0)

  function pose(th) {
    eye.position.set(radius.value * Math.cos(th), height.value, radius.value * Math.sin(th))
    eye.lookAt(look)
  }

  function encode(th) {
    pose(th)
    const R = stage.renderer
    R.setRenderTarget(rt)
    R.setClearColor(C.bg)
    R.clear()
    R.render(stage.scene, eye)
    R.readRenderTargetPixels(rt, 0, 0, PW, PH, px)
    R.setRenderTarget(null)
    const z = [0, 0, 0]
    for (let i = 0, n = PW * PH; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const val = px[i * 4 + c] / 255
        const j = (i * 3 + c) * 3
        z[0] += Wp[j] * val
        z[1] += Wp[j + 1] * val
        z[2] += Wp[j + 2] * val
      }
    }
    return z
  }

  let mean = [0, 0, 0]
  let scale = 1
  const norm = (z) => z.map((v, i) => (v - mean[i]) / scale)

  function trace() {
    const zs = []
    for (let i = 0; i < SAMPLES; i++) zs.push(encode((i / SAMPLES) * 2 * Math.PI))
    mean = [0, 1, 2].map((d) => zs.reduce((a, z) => a + z[d], 0) / SAMPLES)
    scale = 1.5 * Math.sqrt(zs.reduce((a, z) => a + (z[0] - mean[0]) ** 2 + (z[1] - mean[1]) ** 2 + (z[2] - mean[2]) ** 2, 0) / SAMPLES) || 1
    for (let i = 0; i < SAMPLES; i++) {
      // Light smoothing: 16 x 12 pixels flicker as edges cross them.
      const a = norm(zs[(i + SAMPLES - 1) % SAMPLES])
      const b = norm(zs[i])
      const c = norm(zs[(i + 1) % SAMPLES])
      for (let d = 0; d < 3; d++) curvePos[i * 3 + d] = (a[d] + 2 * b[d] + c[d]) / 4
    }
    curveGeo.attributes.position.needsUpdate = true
  }
  radius.on = height.on = trace
  trace()

  let th = 0
  const zs = [0, 0, 0]
  stage.update = (dt, t) => {
    th += dt * 0.35
    const z = norm(encode(th))
    for (let d = 0; d < 3; d++) zs[d] += (z[d] - zs[d]) * 0.25
    dot.position.set(zs[0], zs[1], zs[2])
    craft.position.copy(eye.position)
    craft.rotation.y = -Math.atan2(-Math.sin(th), -Math.cos(th))
    zCam.position.set(6 * Math.cos(t * 0.15), 3, 6 * Math.sin(t * 0.15))
    zCam.lookAt(0, 0, 0)
    fig.readout(`576 numbers in · z = (<b>${zs.map((v) => v.toFixed(2)).join(', ')}</b>)`)
  }
}
