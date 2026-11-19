// One point, three coordinate frames. Everything under `root` is z-up
// (x forward, y left, z up); the camera uses the optical convention
// (z forward, x right, y down).

import { C, THREE, drone, ball, Arrow, Segs, deg } from '../lib.js'

const AXES = [C.meas, C.goal, C.est] // x, y, z
const W = 640
const H = 480
const HF = 35 * deg
const VF = 27.5 * deg

function triad(len, r) {
  const g = new THREE.Group()
  const o = new THREE.Vector3()
  AXES.forEach((c, i) => {
    const a = new Arrow(c, r)
    a.set(o, new THREE.Vector3(i === 0 ? len : 0, i === 1 ? len : 0, i === 2 ? len : 0))
    g.add(a.group)
  })
  return g
}

export default function mount(fig) {
  const stage = fig.stage({ width: 3.3, target: [1.2, 1.15, 0], az: -28, el: 20, grid: 12 })
  const root = new THREE.Group()
  root.rotation.x = -Math.PI / 2
  stage.scene.add(root)
  root.add(triad(1, 0.03))

  const body = new THREE.Group()
  body.rotation.order = 'ZYX'
  const model = new THREE.Group()
  model.rotation.x = Math.PI / 2
  model.add(drone(C.truth, 1, 1.3))
  body.add(model, triad(0.7, 0.022))
  root.add(body)

  const cam = new THREE.Group()
  cam.position.set(0.3, 0, -0.14)
  cam.add(triad(0.5, 0.018))
  const fr = new Segs(8, C.muted, 0.9)
  const d = 1.1
  const cx = Math.tan(HF) * d
  const cy = Math.tan(VF) * d
  const corners = [[cx, cy], [cx, -cy], [-cx, -cy], [-cx, cy]]
  fr.begin()
  corners.forEach(([x, y], i) => {
    const [x2, y2] = corners[(i + 1) % 4]
    fr.add(0, 0, 0, x, y, d)
    fr.add(x, y, d, x2, y2, d)
  })
  fr.end()
  cam.add(fr.mesh)
  body.add(cam)
  const optical = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)),
  )

  const point = ball(C.brass, 0.11)
  point.position.set(2.6, 0.7, 0.5)
  root.add(point)
  const links = new Segs(4, C.muted, 0.7)
  stage.scene.add(links.mesh)

  const yaw = fig.slider('yaw', { min: -180, max: 180, step: 1, value: 18, fmt: (v) => v.toFixed(0) + '°' })
  const pitch = fig.slider('pitch', { min: -30, max: 30, step: 1, value: 0, fmt: (v) => v.toFixed(0) + '°' })
  const tilt = fig.slider('camera tilt', { min: 0, max: 90, step: 1, value: 30, fmt: (v) => v.toFixed(0) + '°' })

  const lW = stage.label('world')
  const lB = stage.label('body')
  const lC = stage.label('camera')
  const lP = stage.label('point', 'brass')
  const p = new THREE.Vector3()
  const o = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)
  const fmt = (v) => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`

  stage.update = (dt, t) => {
    body.position.set(0, 0, 2.2 + 0.05 * Math.sin(t * 1.3))
    body.rotation.set(0, pitch.value * deg, yaw.value * deg)
    cam.quaternion.setFromAxisAngle(yAxis, tilt.value * deg).multiply(optical)
    stage.scene.updateMatrixWorld(true)

    point.getWorldPosition(p)
    const inW = root.worldToLocal(p.clone())
    const inB = body.worldToLocal(p.clone())
    const inC = cam.worldToLocal(p.clone())

    links.begin()
    for (const f of [root, body, cam]) {
      f.getWorldPosition(o)
      links.add(o.x, o.y, o.z, p.x, p.y, p.z)
    }
    links.add(p.x, p.y, p.z, p.x, 0, p.z)
    links.end()

    lW.pos.set(0, 0, 0)
    lW.dy = 30
    body.getWorldPosition(lB.pos).y += 0.35
    cam.getWorldPosition(lC.pos)
    lC.dy = 34
    lP.pos.copy(p).y += 0.15

    const u = W / 2 + ((W / 2) * (inC.x / inC.z)) / Math.tan(HF)
    const v = H / 2 + ((H / 2) * (inC.y / inC.z)) / Math.tan(VF)
    const seen = inC.z > 0 && u >= 0 && u < W && v >= 0 && v < H
    fig.readout(
      `<span class="fig-row"><i>world</i> ${fmt(inW)}</span>` +
        `<span class="fig-row"><i>body</i> ${fmt(inB)}</span>` +
        `<span class="fig-row"><i>camera</i> ${fmt(inC)}</span>` +
        `<span class="fig-row"><i>pixel</i> ${seen ? `(${u.toFixed(0)}, ${v.toFixed(0)}) of ${W}×${H}` : '<b class="meas">out of view</b>'}</span>`,
    )
  }
}
