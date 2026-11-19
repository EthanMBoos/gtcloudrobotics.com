// One future or several. Another car approaches an intersection and either
// continues straight or turns left. A predictor that outputs one trajectory
// and is trained on squared error learns the average of the two, which is a
// path that no car drives. A predictor that outputs both paths with their
// probabilities does not have this problem.

import { C, THREE, rng, rover, mat, at, Ribbon } from '../lib.js'

const LANE = 0.5
const ROAD = 1 // half-width
export const S0 = 2 // distance along the path at which the prediction is made
export const HORIZON = 4 // s
export const SPEED = 2.2

// Position and heading after traveling s along a branch.
export function path(turn, s) {
  const a = 6 - LANE // straight run before the turn
  if (!turn || s <= a) return [-6 + s, LANE, 0]
  const arc = Math.PI / 2
  if (s <= a + arc) {
    const th = s - a
    return [-LANE + Math.sin(th), -LANE + Math.cos(th), -th]
  }
  return [LANE, -LANE - (s - a - arc), -Math.PI / 2]
}

const STEPS = 15
const at_ = (turn, k, v = SPEED) => path(turn, S0 + (v * HORIZON * k) / (STEPS - 1))

// The single trajectory that minimizes expected squared error.
export const meanPath = (p) =>
  Array.from({ length: STEPS }, (_, k) => {
    const a = at_(true, k)
    const b = at_(false, k)
    return [p * a[0] + (1 - p) * b[0], p * a[1] + (1 - p) * b[1]]
  })
export const modePath = (turn) => Array.from({ length: STEPS }, (_, k) => at_(turn, k).slice(0, 2))
export const offRoad = (q) => Math.abs(q[0]) > ROAD && Math.abs(q[1]) > ROAD

// Mean distance over the horizon between a prediction and what one car did.
export function miss(pred, turn, v) {
  let s = 0
  for (let k = 0; k < STEPS; k++) {
    const q = at_(turn, k, v)
    s += Math.hypot(pred[k][0] - q[0], pred[k][1] - q[1])
  }
  return s / STEPS
}

export default function mount(fig) {
  const stage = fig.stage({ width: 7.4, target: [0, 0.3, 0], az: 0, el: 50, grid: 0 })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshBasicMaterial({ color: 0xfbfaf7 }))
  ground.rotation.x = -Math.PI / 2
  stage.scene.add(ground)
  const bm = mat(C.muted, 0.3)
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.7, 4.5), bm)
    stage.scene.add(at(b, sx * (ROAD + 3.25), sy * (ROAD + 2.25), 0.35))
  }
  const other = rover(C.truth)
  const ego = rover(C.brass)
  ego.setPose(-LANE, -4.4, Math.PI / 2)
  const rMean = new Ribbon(STEPS, C.est, 0.16)
  const rTurn = new Ribbon(STEPS, C.est, 0.16, 0.99)
  const rStraight = new Ribbon(STEPS, C.est, 0.16, 0.99)
  stage.scene.add(other, ego, rMean.mesh, rTurn.mesh, rStraight.mesh)
  stage.label('our car', 'brass').pos.set(-LANE, 0.7, -4.4)
  const lMean = stage.label('single prediction', 'est')
  const lT = stage.label('', 'est')
  const lS = stage.label('', 'est')

  const kind = fig.choice([['one', 'one trajectory'], ['two', 'two trajectories with probabilities']], 'one')
  const share = fig.slider('share of cars that turn', { min: 0, max: 100, step: 5, value: 50, fmt: (v) => v + '%' })

  const turnP = modePath(true)
  const straightP = modePath(false)
  rTurn.set(turnP, 0.05)
  rStraight.set(straightP, 0.05)
  let mean, e1, e2, n
  function build() {
    const p = share.value / 100
    mean = meanPath(p)
    rMean.set(mean, 0.05)
    const one = kind.value === 'one'
    rMean.mesh.visible = lMean.show = one
    rTurn.mesh.visible = rStraight.mesh.visible = lT.show = lS.show = !one
    rTurn.mesh.material.opacity = 0.15 + 0.85 * p
    rStraight.mesh.material.opacity = 0.15 + 0.85 * (1 - p)
    lMean.pos.set(mean[STEPS - 1][0], 0.2, mean[STEPS - 1][1])
    lT.el.textContent = `turns: ${share.value}%`
    lS.el.textContent = `straight: ${100 - share.value}%`
    lT.pos.set(turnP[STEPS - 1][0], 0.2, turnP[STEPS - 1][1])
    lS.pos.set(straightP[STEPS - 1][0], 0.2, straightP[STEPS - 1][1])
    e1 = e2 = n = 0
  }
  kind.on = share.on = build
  build()

  const r = rng(4)
  let car = null
  stage.update = (dt) => {
    if (!car || car.s > 12.5) {
      car = { s: 0, turn: r() < share.value / 100, v: SPEED + 0.25 * r.n() }
      n++
      e1 += miss(mean, car.turn, car.v)
      e2 += miss(car.turn ? turnP : straightP, car.turn, car.v)
    }
    car.s += car.v * dt
    other.setPose(...path(car.turn, car.s))
    const end = mean[STEPS - 1]
    fig.readout(
      `average miss over ${n} cars · one trajectory: <b class="meas">${(e1 / n).toFixed(2)} m</b>` +
        (offRoad(end) ? ', and it ends off the road' : '') +
        ` · the nearer of two: <b class="est">${(e2 / n).toFixed(2)} m</b>`,
    )
  }
}
