// A toy ROS graph and the robot it runs on: nodes, topics, timers, parameters,
// services, and a planar robot with a lidar in a room. No rendering code, so
// it runs under node.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const r3 = (v) => Math.round(v * 1000) / 1000

export const TWIST = 'geometry_msgs/msg/Twist'
export const SCAN = 'sensor_msgs/msg/LaserScan'
export const TFMSG = 'tf2_msgs/msg/TFMessage'
export const EMPTY = 'std_srvs/srv/Empty'

// ---------------------------------------------------------------------- world

export const ROOM = [10, 8] // metres, centred on the origin
export const BOXES = [
  [2.7, 1.9, 1.2, 1.2],
  [-2.8, 2.0, 1.0, 1.6],
  [-2.2, -1.9, 1.6, 0.9],
  [2.4, -2.2, 0.9, 0.9],
]
const RADIUS = 0.32

const rect = (cx, cy, w, h) => {
  const [a, b, c, d] = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
  return [[a, b, c, b], [c, b, c, d], [c, d, a, d], [a, d, a, b]]
}
export const SEGS = [rect(0, 0, ...ROOM), ...BOXES.map((b) => rect(...b))].flat()

// Robot state is (x, y, th) with x forward, y left, th counter-clockwise.
export class World {
  constructor(rand) {
    this.rand = rand
    this.cmd = { v: 0, w: 0 }
    this.reset()
  }

  reset() {
    Object.assign(this, { x: 0, y: 0, th: 0, v: 0, w: 0 })
  }

  step(dt) {
    const k = Math.min(1, dt * 8)
    this.v += (this.cmd.v - this.v) * k
    this.w += (this.cmd.w - this.w) * k
    this.th = Math.atan2(Math.sin(this.th + this.w * dt), Math.cos(this.th + this.w * dt))
    this.x += this.v * Math.cos(this.th) * dt
    this.y += this.v * Math.sin(this.th) * dt
    for (let pass = 0; pass < 2; pass++) {
      for (const [x1, y1, x2, y2] of SEGS) {
        const dx = x2 - x1
        const dy = y2 - y1
        const u = clamp(((this.x - x1) * dx + (this.y - y1) * dy) / (dx * dx + dy * dy), 0, 1)
        const px = this.x - (x1 + u * dx)
        const py = this.y - (y1 + u * dy)
        const d = Math.hypot(px, py)
        if (d >= RADIUS || d < 1e-9) continue
        this.x += (px / d) * (RADIUS - d)
        this.y += (py / d) * (RADIUS - d)
      }
    }
  }

  // n beams from -pi, counter-clockwise, relative to the heading.
  ranges(n, max) {
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
      const a = this.th - Math.PI + (i * 2 * Math.PI) / n
      const cx = Math.cos(a)
      const cy = Math.sin(a)
      let best = Infinity
      for (const [x1, y1, x2, y2] of SEGS) {
        const ex = x2 - x1
        const ey = y2 - y1
        const den = cx * ey - cy * ex
        if (Math.abs(den) < 1e-12) continue
        const t = ((x1 - this.x) * ey - (y1 - this.y) * ex) / den
        const u = ((x1 - this.x) * cy - (y1 - this.y) * cx) / den
        if (t > 0 && u >= 0 && u <= 1 && t < best) best = t
      }
      best += 0.01 * this.rand.n()
      out[i] = best > max ? Infinity : r3(Math.max(best, 0))
    }
    return out
  }
}

// ---------------------------------------------------------------------- graph

class Node {
  constructor(g, name, kind) {
    Object.assign(this, { g, name, kind, alive: true, pubs: [], subs: [], timers: [], services: [], cleanup: null })
    this.params = new Map()
    if (kind === 'node') this.params.set('use_sim_time', false)
  }

  pub(name, type, latch = false) {
    const t = this.g.topic(name, type)
    const p = { node: this, topic: t }
    t.pubs.add(p)
    this.pubs.push(p)
    return { publish: (msg) => this.alive && this.g.publish(t, msg, latch) }
  }

  sub(name, type, fn) {
    const t = this.g.topic(name, type)
    const s = { node: this, topic: t, fn }
    t.subs.add(s)
    this.subs.push(s)
    if (t.latched) fn(t.latched)
  }

  timer(period, fn) {
    this.timers.push({ period, fn, next: this.g.t + period })
  }

  param(name, value) {
    this.params.set(name, value)
  }

  get(name) {
    return this.params.get(name)
  }

  service(name, type, fn) {
    this.services.push({ name, type, fn })
  }

  destroy() {
    if (!this.alive) return
    this.alive = false
    for (const p of this.pubs) p.topic.pubs.delete(p)
    for (const s of this.subs) s.topic.subs.delete(s)
    this.g.nodes = this.g.nodes.filter((n) => n !== this)
    if (this.cleanup) this.cleanup()
  }
}

export class Graph {
  constructor(world, rand) {
    Object.assign(this, { world, rand, t: 0, now: 0, nodes: [], epoch: Date.now() / 1000, seq: 0 })
    this.topics = new Map()
    this.bags = new Map()
  }

  node(name, kind = 'node') {
    const n = new Node(this, name, kind)
    this.nodes.push(n)
    return n
  }

  // Anonymous node for a command-line tool. Real ros2 tools hide theirs too.
  cli(label) {
    return Object.assign(this.node('_ros2cli_' + (4000 + 37 * ++this.seq), 'cli'), { label })
  }

  find(name) {
    return this.nodes.find((n) => n.kind === 'node' && n.name === name.replace(/^\//, ''))
  }

  launch(name, params = {}) {
    const n = FACTORY[name](this)
    for (const [k, v] of Object.entries(params)) if (n.params.has(k)) n.params.set(k, v)
    return n
  }

  topic(name, type) {
    if (!this.topics.has(name)) this.topics.set(name, { name, type, pubs: new Set(), subs: new Set(), stamps: [], latched: null })
    return this.topics.get(name)
  }

  publish(t, msg, latch) {
    t.stamps.push(this.now)
    if (t.stamps.length > 40) t.stamps.shift()
    if (latch) t.latched = msg
    for (const s of [...t.subs]) if (s.node.alive) s.fn(msg)
  }

  rate(t) {
    const s = t.stamps.filter((x) => x > this.t - 2)
    if (!s.length || this.t - s[s.length - 1] > 1.3) return 0
    return s.length > 1 ? (s.length - 1) / (s[s.length - 1] - s[0]) : 1
  }

  stamp() {
    const s = this.epoch + this.now
    return { sec: Math.floor(s), nanosec: Math.floor((s % 1) * 1e9) }
  }

  step(dt) {
    const end = this.t + dt
    for (const n of [...this.nodes]) {
      for (const tm of n.timers) {
        while (n.alive && tm.next <= end) {
          this.now = tm.next
          tm.next += tm.period
          tm.fn()
        }
      }
    }
    this.t = this.now = end
    for (const [k, t] of this.topics) {
      if (t.pubs.size || t.subs.size) continue
      this.topics.delete(k)
    }
  }
}

// ---------------------------------------------------------------- transforms

const quat = (yaw) => ({ x: 0.0, y: 0.0, z: r3(Math.sin(yaw / 2)), w: r3(Math.cos(yaw / 2)) })
const yawOf = (q) => 2 * Math.atan2(q.z, q.w)

function transform(g, parent, child, x, y, z, yaw) {
  return {
    header: { stamp: g.stamp(), frame_id: parent },
    child_frame_id: child,
    transform: { translation: { x: r3(x), y: r3(y), z }, rotation: quat(yaw) },
  }
}

const compose = (a, b) => ({
  x: a.x + Math.cos(a.yaw) * b.x - Math.sin(a.yaw) * b.y,
  y: a.y + Math.sin(a.yaw) * b.x + Math.cos(a.yaw) * b.y,
  z: a.z + b.z,
  yaw: a.yaw + b.yaw,
})

const invert = (a) => compose({ x: 0, y: 0, z: 0, yaw: -a.yaw }, { x: -a.x, y: -a.y, z: -a.z, yaw: 0 })

// Listens to /tf and /tf_static on the given node and answers lookups. A
// transform on /tf that has not been refreshed for a second is treated as gone.
export class Tf {
  constructor(node) {
    this.g = node.g
    this.frames = new Map()
    const add = (fixed) => (m) => {
      for (const tr of m.transforms) {
        const { translation: p, rotation: q } = tr.transform
        this.frames.set(tr.child_frame_id, { parent: tr.header.frame_id, T: { x: p.x, y: p.y, z: p.z, yaw: yawOf(q) }, t: this.g.t, fixed })
      }
    }
    node.sub('/tf', TFMSG, add(false))
    node.sub('/tf_static', TFMSG, add(true))
  }

  // Chain from a frame up to its root: [root name, transform root <- frame].
  up(frame) {
    let T = { x: 0, y: 0, z: 0, yaw: 0 }
    for (let i = 0; i < 8; i++) {
      const f = this.frames.get(frame)
      if (!f || (!f.fixed && this.g.t - f.t > 1)) return [frame, T]
      T = compose(f.T, T)
      frame = f.parent
    }
    return [frame, T]
  }

  // Pose of `source` expressed in `target`, or null.
  lookup(target, source) {
    const [ra, A] = this.up(target)
    const [rb, B] = this.up(source)
    if (ra !== rb) return null
    const T = compose(invert(A), B)
    T.yaw = Math.atan2(Math.sin(T.yaw), Math.cos(T.yaw))
    return T
  }
}

// ---------------------------------------------------------------------- nodes

export const BEAMS = 180

const FACTORY = {
  // Lidar driver: one full sweep, ten times a second.
  lidar(g) {
    const n = g.node('lidar')
    n.param('range_max', 6.0)
    const pub = n.pub('/scan', SCAN)
    n.timer(0.1, () => {
      const max = n.get('range_max')
      pub.publish({
        header: { stamp: g.stamp(), frame_id: 'laser' },
        angle_min: r3(-Math.PI),
        angle_max: r3(Math.PI - (2 * Math.PI) / BEAMS),
        angle_increment: r3((2 * Math.PI) / BEAMS),
        time_increment: 0.0,
        scan_time: 0.1,
        range_min: 0.1,
        range_max: max,
        ranges: g.world.ranges(BEAMS, max),
        intensities: [],
      })
    })
    return n
  },

  // Motor driver: turns /cmd_vel into motion and publishes where the wheels say
  // the robot is, as the transform from odom to base_link. A command older than cmd_vel_timeout is dropped.
  base(g) {
    const n = g.node('base')
    const w = g.world
    n.param('cmd_vel_timeout', 0.6)
    let cmd = { v: 0, w: 0 }
    let last = -1e9
    n.sub('/cmd_vel', TWIST, (m) => {
      cmd = { v: clamp(m.linear.x, -1, 1), w: clamp(m.angular.z, -2, 2) }
      last = g.now
    })
    const tf = n.pub('/tf', TFMSG)
    n.pub('/tf_static', TFMSG, true).publish({ transforms: [transform(g, 'base_link', 'laser', 0, 0, 0.2, 0)] })
    n.timer(0.05, () => {
      w.cmd = g.now - last < n.get('cmd_vel_timeout') ? cmd : { v: 0, w: 0 }
      tf.publish({ transforms: [transform(g, 'odom', 'base_link', w.x, w.y, 0.0, w.th)] })
    })
    n.service('/reset', EMPTY, () => w.reset())
    n.cleanup = () => (w.cmd = { v: 0, w: 0 })
    return n
  },

  // The node whose source is on the page: drive forward, turn left when the
  // 60 degrees ahead are blocked.
  avoid(g) {
    const n = g.node('avoid')
    n.param('speed', 0.4)
    n.param('stop_distance', 0.8)
    const pub = n.pub('/cmd_vel', TWIST)
    n.sub('/scan', SCAN, (scan) => {
      const mid = scan.ranges.length >> 1
      const ahead = Math.min(...scan.ranges.slice(mid - 15, mid + 15))
      const cmd = blankTwist()
      if (ahead > n.get('stop_distance')) cmd.linear.x = n.get('speed')
      else cmd.angular.z = 1.0
      pub.publish(cmd)
    })
    return n
  },
}

export const EXECUTABLES = Object.keys(FACTORY)

export const blankTwist = () => ({ linear: { x: 0.0, y: 0.0, z: 0.0 }, angular: { x: 0.0, y: 0.0, z: 0.0 } })
