// Toy world for the world-model figures: a drone as a planar point mass with
// drag, pushed by a wind field. State is [x, y, vx, vy], action is [ax, ay]
// in [-1, 1]. The "model" is the same dynamics with a wrong drag term and
// only as much of the wind as its training data covered. It stands in for a
// learned latent model; nothing here is trained.

export const DT = 0.1
export const ACC = 3
export const DRAG = 0.9
export const ALT = 1.3 // height the drone is drawn at

export const wind = (x, y) => [0.9 * Math.sin(0.55 * y + 0.8) + 0.4 * Math.cos(0.4 * x), 0.8 * Math.cos(0.5 * x - 0.4)]

function step(s, a, w, drag, dt) {
  const ax = a[0] * ACC + w[0] - drag * s[2]
  const ay = a[1] * ACC + w[1] - drag * s[3]
  return [s[0] + s[2] * dt + 0.5 * ax * dt * dt, s[1] + s[3] * dt + 0.5 * ay * dt * dt, s[2] + ax * dt, s[3] + ay * dt]
}

export const trueStep = (s, a, dt = DT) => step(s, a, wind(s[0], s[1]), DRAG, dt)

// cov: how much of the wind the model has learned, 0..1, a number or cov(x, y).
// eps: fractional error in its drag.
export function modelStep(s, a, { cov = 0, eps = 0.1 } = {}, dt = DT) {
  const w = wind(s[0], s[1])
  const c = typeof cov === 'function' ? cov(s[0], s[1]) : cov
  return step(s, a, [w[0] * c, w[1] * c], DRAG * (1 + eps), dt)
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
