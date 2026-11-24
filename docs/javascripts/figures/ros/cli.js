// An imitation of a small part of the ros2 command line, running against the
// toy graph in ros.js. Output formats follow the real tools closely enough
// that what is learned here carries over. No DOM code, so it runs under node.

import { Tf, TWIST, SCAN, TFMSG, EMPTY, EXECUTABLES, blankTwist } from './ros.js'

const PKG = 'crash_course'

const HELP = `This terminal imitates part of the ros2 command line. It understands:
  ros2 node list | info <node>
  ros2 topic list [-t] | info <topic> | type <topic>
  ros2 topic echo <topic> [--once] [--field <path>]
  ros2 topic hz <topic>
  ros2 topic pub [--once] [--rate <hz>] <topic> <type> "<yaml>"
  ros2 interface show <type>
  ros2 run ${PKG} avoid [--ros-args -p <name>:=<value>]
  ros2 run teleop_twist_keyboard teleop_twist_keyboard
  ros2 run tf2_ros tf2_echo <target frame> <source frame>
  ros2 param list | get <node> <name> | set <node> <name> <value>
  ros2 service list [-t] | type <service> | call <service> <type>
  ros2 bag record -o <name> --topics <topic> ... | info <name> | play <name>
  clear
Ctrl-C stops a command that keeps running.`

const SHOW = {
  'geometry_msgs/msg/Vector3': `# This represents a vector in free space.

float64 x
float64 y
float64 z`,
  [TWIST]: `# This expresses velocity in free space broken into its linear and angular parts.

Vector3  linear
	float64 x
	float64 y
	float64 z
Vector3  angular
	float64 x
	float64 y
	float64 z`,
  [SCAN]: `# Single scan from a planar laser range-finder

std_msgs/Header header # timestamp in the header is the acquisition time of
	builtin_interfaces/Time stamp
		int32 sec
		uint32 nanosec
	string frame_id
                             # the first ray in the scan.

float32 angle_min            # start angle of the scan [rad]
float32 angle_max            # end angle of the scan [rad]
float32 angle_increment      # angular distance between measurements [rad]

float32 time_increment       # time between measurements [seconds]
float32 scan_time            # time between scans [seconds]

float32 range_min            # minimum range value [m]
float32 range_max            # maximum range value [m]

float32[] ranges             # range data [m]
                             # (Note: values < range_min or > range_max should be discarded)
float32[] intensities        # intensity data [device-specific units]`,
  [TFMSG]: `geometry_msgs/TransformStamped[] transforms
	std_msgs/Header header
		builtin_interfaces/Time stamp
			int32 sec
			uint32 nanosec
		string frame_id
	string child_frame_id
	Transform transform
		Vector3 translation
			float64 x
			float64 y
			float64 z
		Quaternion rotation
			float64 x 0
			float64 y 0
			float64 z 0
			float64 w 1`,
  [EMPTY]: '---',
}

// Topics and services that every real node creates. They are listed so the
// output matches a real system, but nothing here publishes on them.
const COMMON_TOPICS = [
  ['/parameter_events', 'rcl_interfaces/msg/ParameterEvent'],
  ['/rosout', 'rcl_interfaces/msg/Log'],
]
const PARAM_SERVICES = [
  ['describe_parameters', 'rcl_interfaces/srv/DescribeParameters'],
  ['get_parameter_types', 'rcl_interfaces/srv/GetParameterTypes'],
  ['get_parameters', 'rcl_interfaces/srv/GetParameters'],
  ['get_type_description', 'type_description_interfaces/srv/GetTypeDescription'],
  ['list_parameters', 'rcl_interfaces/srv/ListParameters'],
  ['set_parameters', 'rcl_interfaces/srv/SetParameters'],
  ['set_parameters_atomically', 'rcl_interfaces/srv/SetParametersAtomically'],
]

// ------------------------------------------------------------------- parsing

function tokens(line) {
  const out = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

// Flow-style YAML, which is what message arguments are written in.
function yaml(src) {
  let i = 0
  const ws = () => {
    while (src[i] === ' ') i++
  }
  const value = () => {
    ws()
    if (src[i] === '{') {
      i++
      const o = {}
      for (ws(); src[i] !== '}'; ws()) {
        const k = /^[\w.]+/.exec(src.slice(i))
        if (!k) throw 0
        i += k[0].length
        ws()
        if (src[i++] !== ':') throw 0
        o[k[0]] = value()
        ws()
        if (src[i] === ',') i++
        else if (src[i] !== '}') throw 0
      }
      i++
      return o
    }
    if (src[i] === '[') {
      i++
      const a = []
      for (ws(); src[i] !== ']'; ws()) {
        a.push(value())
        ws()
        if (src[i] === ',') i++
        else if (src[i] !== ']') throw 0
      }
      i++
      return a
    }
    const s = /^[^,{}\[\]]*/.exec(src.slice(i))[0]
    i += s.length
    return scalar(s.trim())
  }
  const v = value()
  ws()
  if (i < src.length) throw 0
  return v
}

function scalar(s) {
  if (s === 'true' || s === 'false') return s === 'true'
  if (s !== '' && !isNaN(s)) return +s
  return s
}

// Copy matching numeric fields of `src` into the message `dst`.
function fill(dst, src) {
  if (typeof src !== 'object' || src === null || Array.isArray(src)) throw 0
  for (const [k, v] of Object.entries(src)) {
    if (!(k in dst)) throw 0
    if (typeof dst[k] === 'object') fill(dst[k], v)
    else if (typeof v !== 'number') throw 0
    else dst[k] = v
  }
}

// ---------------------------------------------------------------- formatting

const INTS = new Set(['sec', 'nanosec'])

function num(k, v) {
  if (INTS.has(k)) return String(v)
  if (Number.isNaN(v)) return '.nan'
  if (!Number.isFinite(v)) return v > 0 ? '.inf' : '-.inf'
  return Number.isInteger(v) ? v.toFixed(1) : String(v)
}

function atom(k, v) {
  if (typeof v === 'number') return num(k, v)
  if (typeof v === 'string') return v === '' ? "''" : v
  return String(v)
}

// Block-style YAML, as `ros2 topic echo` prints it. Long arrays are cut short.
function dump(v, ind = '') {
  const out = []
  for (const [k, x] of Object.entries(v)) {
    if (Array.isArray(x)) {
      if (!x.length) out.push(`${ind}${k}: []`)
      else {
        out.push(`${ind}${k}:`)
        for (const e of x.slice(0, 8)) {
          if (typeof e === 'object') dump(e, ind + '  ').forEach((l, i) => out.push(ind + (i ? '  ' : '- ') + l.slice(ind.length + 2)))
          else out.push(`${ind}- ${atom(k, e)}`)
        }
        if (x.length > 8) out.push(`${ind}- '...'`)
      }
    } else if (typeof x === 'object') out.push(`${ind}${k}:`, ...dump(x, ind + '  '))
    else out.push(`${ind}${k}: ${atom(k, x)}`)
  }
  return out
}

const f1 = (v) => num('', v)
const reprTwist = (m) =>
  `geometry_msgs.msg.Twist(linear=geometry_msgs.msg.Vector3(x=${f1(m.linear.x)}, y=${f1(m.linear.y)}, z=${f1(m.linear.z)}), ` +
  `angular=geometry_msgs.msg.Vector3(x=${f1(m.angular.x)}, y=${f1(m.angular.y)}, z=${f1(m.angular.z)}))`

// The real banner is twice as long; this is the part that fits the terminal.
const TELEOP = `Moving around:
   u    i    o
   j    k    l
   m    ,    .
anything else : stop
q/z : increase/decrease max speeds by 10%
CTRL-C to quit`
const MOVES = { i: [1, 0], o: [1, -1], j: [0, 1], l: [0, -1], u: [1, 1], ',': [-1, 0], '.': [-1, 1], m: [-1, -1] }
const SPEEDS = { q: [1.1, 1.1], z: [0.9, 0.9], w: [1.1, 1], x: [0.9, 1], e: [1, 1.1], c: [1, 0.9] }

// ---------------------------------------------------------------------- shell

const COMMANDS = new Set(
  'node_list node_info topic_list topic_type topic_info topic_echo topic_hz topic_pub interface_show param_list param_get param_set service_list service_type service_call bag_record bag_info bag_play'.split(' '),
)

export class Shell {
  // out(line) receives each line of output; done() is called when the prompt returns.
  constructor(graph, out, done = () => {}) {
    Object.assign(this, { g: graph, out, done, node: null, onKey: null, onStop: null })
  }

  get busy() {
    return !!this.node || !!this.onStop
  }

  get raw() {
    return !!this.onKey
  }

  print(text) {
    for (const l of String(text).split('\n')) this.out(l)
  }

  log(name, text, level = 'INFO') {
    const s = this.g.stamp()
    this.print(`[${level}] [${s.sec}.${String(s.nanosec).padStart(9, '0')}] [${name}]: ${text}`)
  }

  // Begin a command that keeps running until Ctrl-C or finish().
  hold(node, onStop = null) {
    this.node = node
    this.onStop = onStop
  }

  finish() {
    if (this.onStop) this.onStop()
    if (this.node) this.node.destroy()
    this.node = this.onKey = this.onStop = null
    if (!this.inExec) this.done()
  }

  interrupt() {
    if (this.busy) this.finish()
  }

  key(k) {
    if (this.onKey) this.onKey(k)
  }

  // Tab completion of the last word, from every name the shell knows.
  complete(line) {
    const words = line.split(' ')
    const part = words.pop()
    const verbs = { node: 'list info', topic: 'list info type echo hz pub', interface: 'show', run: `${PKG} teleop_twist_keyboard tf2_ros`, param: 'list get set', service: 'list type call', bag: 'record info play' }
    let pool
    if (!words.length) pool = ['ros2', 'clear', 'help']
    else if (words.length === 1) pool = Object.keys(verbs)
    else if (words.length === 2) pool = (verbs[words[1]] || '').split(' ')
    else {
      pool = [
        ...this.topics().flat().filter((x) => typeof x === 'string'),
        ...this.services().flatMap((s) => [s[0], s[1]]),
        ...this.nodes().flatMap((n) => ['/' + n.name, ...n.params.keys()]),
        ...this.g.bags.keys(),
        ...EXECUTABLES,
        ...'teleop_twist_keyboard tf2_echo odom base_link laser --once --rate --field --topics --loop --ros-args'.split(' '),
      ]
    }
    const hits = [...new Set(pool)].filter((x) => x && x.startsWith(part))
    if (!hits.length) return line
    let common = hits[0]
    for (const x of hits) while (!x.startsWith(common)) common = common.slice(0, -1)
    return [...words, common].join(' ') + (hits.length === 1 ? ' ' : '')
  }

  exec(line) {
    if (this.busy) return
    const a = tokens(line)
    if (!a.length) return this.done()
    this.inExec = true
    try {
      this.dispatch(a)
    } catch (err) {
      if (typeof err !== 'string') throw err
      this.print(err)
    } finally {
      this.inExec = false
    }
    if (!this.busy) this.done()
  }

  dispatch(a) {
    if (a[0] === 'clear') return this.out(null)
    if (a[0] === 'help') return this.print(HELP)
    if (a[0] !== 'ros2') throw `bash: ${a[0]}: command not found (this terminal only knows ros2; try "help")`
    if (a.includes('--help') || a.includes('-h')) return this.print(HELP)
    if (a[1] === 'run') return this.run(a.slice(2))
    const fn = COMMANDS.has(`${a[1]}_${a[2]}`) && this[`${a[1]}_${a[2]}`]
    if (!fn) return this.print(HELP)
    fn.call(this, a.slice(3))
  }

  // -- helpers

  nodes() {
    return this.g.nodes.filter((n) => n.kind === 'node').sort((a, b) => (a.name < b.name ? -1 : 1))
  }

  // [name, type, publisher count, subscription count] for every topic.
  topics() {
    const n = this.nodes().length
    const list = [...this.g.topics.values()].map((t) => {
      const count = (set) => [...set].filter((e) => e.node.kind !== 'hidden').length
      return [t.name, t.type, count(t.pubs), count(t.subs)]
    })
    if (n) list.push(...COMMON_TOPICS.map(([name, type]) => [name, type, n, name === '/rosout' ? 0 : n]))
    return list.filter((t) => t[2] + t[3] > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }

  topic(name) {
    const t = this.topics().find((x) => x[0] === name)
    if (!t) throw `WARNING: topic [${name}] does not appear to be published yet\nCould not determine the type for the passed topic`
    return t
  }

  services() {
    const out = []
    for (const n of this.nodes()) {
      for (const [s, type] of PARAM_SERVICES) out.push([`/${n.name}/${s}`, type, null])
      for (const s of n.services) out.push([s.name, s.type, s.fn])
    }
    return out.sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }

  need(a, n, usage) {
    if (a.length < n) throw `usage: ros2 ${usage}`
  }

  findNode(name) {
    const n = this.g.find(name || '')
    if (!n) throw 'Node not found'
    return n
  }

  // -- node

  node_list() {
    for (const n of this.nodes()) this.print('/' + n.name)
  }

  node_info(a) {
    this.need(a, 1, 'node info <node>')
    const n = this.g.find(a[0])
    if (!n) throw `Unable to find node '${a[0]}'`
    const subs = [['/parameter_events', COMMON_TOPICS[0][1]], ...n.subs.map((s) => [s.topic.name, s.topic.type])]
    const pubs = [...COMMON_TOPICS, ...n.pubs.map((p) => [p.topic.name, p.topic.type])]
    const srvs = this.services().filter((s) => s[0].startsWith(`/${n.name}/`) || n.services.some((x) => x.name === s[0]))
    const block = (title, rows) => [`  ${title}:`, ...rows.sort().map(([k, t]) => `    ${k}: ${t}`)]
    this.print(
      [
        '/' + n.name,
        ...block('Subscribers', subs),
        ...block('Publishers', pubs),
        ...block('Service Servers', srvs),
        '  Service Clients:',
        '',
        '  Action Servers:',
        '',
        '  Action Clients:',
        '',
      ].join('\n'),
    )
  }

  // -- topic

  topic_list(a) {
    const types = a.includes('-t') || a.includes('--show-types')
    for (const [name, type] of this.topics()) this.print(types ? `${name} [${type}]` : name)
  }

  topic_type(a) {
    this.need(a, 1, 'topic type <topic>')
    this.print(this.topic(a[0])[1])
  }

  topic_info(a) {
    this.need(a, 1, 'topic info <topic>')
    const t = this.topics().find((x) => x[0] === a[0])
    if (!t) throw `Unknown topic '${a[0]}'`
    this.print(`Type: ${t[1]}\nPublisher count: ${t[2]}\nSubscription count: ${t[3]}`)
  }

  topic_echo(a) {
    const once = a.includes('--once')
    const fi = a.indexOf('--field')
    const field = fi < 0 ? null : a[fi + 1]
    const name = a.find((x, i) => !x.startsWith('-') && (fi < 0 || i !== fi + 1))
    if (!name) throw 'usage: ros2 topic echo <topic> [--once] [--field <path>]'
    const [, type] = this.topic(name)
    const node = this.g.cli('ros2 topic echo')
    this.hold(node)
    node.sub(name, type, (msg) => {
      let v = msg
      for (const k of field ? field.split('.') : []) v = v == null ? v : v[k]
      if (v === undefined) {
        this.print(`Invalid field '${field}': '${type.split('/').pop()}' object has no such attribute`)
        return this.finish()
      }
      this.print(typeof v === 'object' && !Array.isArray(v) ? dump(v).join('\n') : Array.isArray(v) ? dump({ v }).slice(1).join('\n') : atom('', v))
      this.print('---')
      if (once) this.finish()
    })
  }

  topic_hz(a) {
    this.need(a, 1, 'topic hz <topic>')
    const [, type] = this.topic(a[0])
    const node = this.g.cli('ros2 topic hz')
    this.hold(node)
    const gaps = []
    let last = null
    node.sub(a[0], type, () => {
      if (last != null) gaps.push(this.g.now - last)
      last = this.g.now
    })
    node.timer(1, () => {
      if (!gaps.length) return
      const mean = gaps.reduce((s, x) => s + x, 0) / gaps.length
      const sd = Math.sqrt(gaps.reduce((s, x) => s + (x - mean) ** 2, 0) / gaps.length)
      this.print(`average rate: ${(1 / mean).toFixed(3)}`)
      this.print(
        `\tmin: ${Math.min(...gaps).toFixed(3)}s max: ${Math.max(...gaps).toFixed(3)}s std dev: ${sd.toFixed(5)}s window: ${gaps.length + 1}`,
      )
    })
  }

  topic_pub(a) {
    let once = false
    let rate = 1
    const rest = []
    for (let i = 0; i < a.length; i++) {
      if (a[i] === '--once' || a[i] === '-1') once = true
      else if (a[i] === '--rate' || a[i] === '-r') rate = +a[++i]
      else rest.push(a[i])
    }
    const [name, type, text = '{}'] = rest
    if (!name || !type) throw 'usage: ros2 topic pub [--once] [--rate <hz>] <topic> <type> "<yaml>"'
    if (!(rate > 0)) throw 'ros2 topic pub: error: argument -r/--rate: value must be a positive number'
    if (type !== TWIST) {
      throw SHOW[type]
        ? `this terminal can only publish ${TWIST}`
        : 'The passed message type is invalid'
    }
    const existing = this.g.topics.get(name)
    if (existing && existing.type !== type) throw `Incompatible type: the topic ${name} carries ${existing.type}`
    const msg = blankTwist()
    try {
      fill(msg, yaml(text))
    } catch {
      throw `Failed to populate field: the message could not be built from ${text}\nThe fields of a type are listed by: ros2 interface show ${type}`
    }
    const node = this.g.cli('ros2 topic pub')
    const pub = node.pub(name, type)
    this.hold(node)
    this.print('publisher: beginning loop')
    let n = 0
    const send = () => {
      this.print(`publishing #${++n}: ${reprTwist(msg)}`)
      this.print('')
      pub.publish(JSON.parse(JSON.stringify(msg)))
    }
    send()
    if (once) return this.finish()
    node.timer(1 / rate, send)
  }

  // -- interface

  interface_show(a) {
    this.need(a, 1, 'interface show <type>')
    if (!(a[0] in SHOW)) throw `Unknown package or type '${a[0]}' (this terminal knows: ${Object.keys(SHOW).join(', ')})`
    this.print(SHOW[a[0]])
  }

  // -- run

  run(a) {
    const split = a.indexOf('--ros-args')
    const [pkg, exe, ...args] = split < 0 ? a : a.slice(0, split)
    const params = {}
    const ra = split < 0 ? [] : a.slice(split + 1)
    for (let i = 0; i < ra.length; i++) {
      const m = /^(\w+):=(.+)$/.exec(ra[i] === '-p' ? ra[++i] || '' : '')
      if (!m) throw `unknown ROS argument: ${ra[i]}`
      params[m[1]] = scalar(m[2])
    }
    if (!pkg || !exe) throw 'usage: ros2 run <package> <executable>'
    if (pkg === 'teleop_twist_keyboard' && exe === pkg) return this.teleop()
    if (pkg === 'tf2_ros' && exe === 'tf2_echo') return this.tf2echo(args)
    if (!['teleop_twist_keyboard', 'tf2_ros', PKG].includes(pkg)) throw `Package '${pkg}' not found`
    if (pkg !== PKG || !EXECUTABLES.includes(exe)) throw 'No executable found'
    if (this.g.find(exe)) throw `A node named /${exe} is already running, and this page allows one of each.`
    const node = this.g.launch(exe, params)
    this.hold(node)
    if (exe === 'avoid') this.log('avoid', 'avoiding obstacles')
  }

  teleop() {
    const node = this.g.node('teleop_twist_keyboard')
    const pub = node.pub('/cmd_vel', TWIST)
    let speed = 0.5
    let turn = 1.0
    const status = () => this.print(`currently:\tspeed ${num('', speed)}\tturn ${num('', turn)} `)
    this.hold(node)
    this.print(TELEOP)
    status()
    this.onKey = (k) => {
      if (SPEEDS[k]) {
        speed = +(speed * SPEEDS[k][0]).toPrecision(4)
        turn = +(turn * SPEEDS[k][1]).toPrecision(4)
        return status()
      }
      const [x, th] = MOVES[k] || [0, 0]
      const msg = blankTwist()
      msg.linear.x = x * speed
      msg.angular.z = th * turn
      pub.publish(msg)
    }
  }

  tf2echo(a) {
    this.need(a, 2, 'run tf2_ros tf2_echo <target frame> <source frame>')
    const node = this.g.cli('tf2_echo')
    const tf = new Tf(node)
    this.hold(node)
    const p = (v) => (Object.is(v, -0) ? 0 : v).toFixed(3)
    node.timer(1, () => {
      const T = tf.lookup(a[0], a[1])
      if (!T) {
        const missing = [a[0], a[1]].find((f) => !tf.frames.has(f) && ![...tf.frames.values()].some((x) => x.parent === f))
        return this.print(
          missing
            ? `Invalid frame ID "${missing}" passed to canTransform argument - frame does not exist`
            : `Could not transform "${a[1]}" to "${a[0]}": the transform between them has not been published in the last second`,
        )
      }
      const s = this.g.stamp()
      this.print(
        [
          `At time ${s.sec}.${String(s.nanosec).padStart(9, '0')}`,
          `- Translation: [${p(T.x)}, ${p(T.y)}, ${p(T.z)}]`,
          `- Rotation: in Quaternion (xyzw) [0.000, 0.000, ${p(Math.sin(T.yaw / 2))}, ${p(Math.cos(T.yaw / 2))}]`,
          `- Rotation: in RPY (radian) [0.000, -0.000, ${p(T.yaw)}]`,
          `- Rotation: in RPY (degree) [0.000, -0.000, ${p((T.yaw * 180) / Math.PI)}]`,
        ].join('\n'),
      )
    })
  }

  // -- param

  param_list(a) {
    const list = a[0] ? [this.findNode(a[0])] : this.nodes()
    for (const n of list) {
      if (!a[0]) this.print(`/${n.name}:`)
      for (const k of [...n.params.keys()].sort()) this.print(`  ${k}`)
    }
  }

  param_get(a) {
    this.need(a, 2, 'param get <node> <name>')
    const n = this.findNode(a[0])
    if (!n.params.has(a[1])) throw 'Parameter not set'
    const v = n.get(a[1])
    this.print(typeof v === 'boolean' ? `Boolean value is: ${v ? 'True' : 'False'}` : `Double value is: ${num('', v)}`)
  }

  param_set(a) {
    this.need(a, 3, 'param set <node> <name> <value>')
    const n = this.findNode(a[0])
    if (!n.params.has(a[1])) throw `Setting parameter failed: parameter '${a[1]}' cannot be set because it was not declared`
    const v = scalar(a[2])
    const want = typeof n.get(a[1])
    if (typeof v !== want) throw `Setting parameter failed: Wrong parameter type, parameter {${a[1]}} is of type {${want === 'number' ? 'double' : 'bool'}}, setting it to {${typeof v === 'number' ? 'double' : typeof v === 'boolean' ? 'bool' : 'string'}} is not allowed.`
    n.param(a[1], v)
    this.print('Set parameter successful')
  }

  // -- service

  service_list(a) {
    const types = a.includes('-t') || a.includes('--show-types')
    for (const [name, type] of this.services()) this.print(types ? `${name} [${type}]` : name)
  }

  service_type(a) {
    this.need(a, 1, 'service type <service>')
    const s = this.services().find((x) => x[0] === a[0])
    if (s) this.print(s[1])
  }

  service_call(a) {
    this.need(a, 2, 'service call <service> <type>')
    const s = this.services().find((x) => x[0] === a[0])
    if (!s) throw 'waiting for service to become available...\n(no node offers that service; Ctrl-C would end the wait)'
    if (a[1] !== s[1]) throw `The service ${a[0]} has type ${s[1]}`
    if (!s[2]) throw 'this terminal can only call services of type ' + EMPTY
    s[2]()
    this.print('requester: making request: std_srvs.srv.Empty_Request()\n\nresponse:\nstd_srvs.srv.Empty_Response()\n')
  }

  // -- bag

  bag_record(a) {
    let name = null
    let all = false
    const names = []
    for (let i = 0; i < a.length; i++) {
      if (a[i] === '-o' || a[i] === '--output') name = a[++i]
      else if (a[i] === '-a' || a[i] === '--all') all = true
      else if (a[i] !== '--topics') names.push(a[i])
    }
    const known = this.topics().filter((t) => this.g.topics.has(t[0]))
    const picked = all ? known : known.filter((t) => names.includes(t[0]))
    if (!all && !names.length) throw 'usage: ros2 bag record -o <name> --topics <topic> ...   (or -a for every topic)'
    name = name || 'rosbag2_' + new Date().toISOString().slice(0, 19).replace(/[-:]/g, '_').replace('T', '-')
    if (this.g.bags.has(name)) throw `[ERROR] [ros2bag]: Output folder '${name}' already exists.`
    const node = this.g.node('rosbag2_recorder')
    const bag = { name, start: this.g.epoch + this.g.t, t0: this.g.t, duration: 0, msgs: [], types: new Map(picked.map((t) => [t[0], t[1]])) }
    const me = 'rosbag2_recorder'
    this.log(me, 'Press SPACE for pausing/resuming')
    for (const [topic, type] of picked) {
      node.sub(topic, type, (msg) => {
        if (bag.msgs.length >= 6000) {
          this.print('(this terminal stops a recording at 6000 messages)')
          return this.finish()
        }
        bag.msgs.push({ t: this.g.now - bag.t0, topic, msg })
      })
      this.log(me, `Subscribed to topic '${topic}'`)
    }
    this.log(me, 'Recording...')
    this.hold(node, () => {
      bag.duration = this.g.t - bag.t0
      this.g.bags.set(name, bag)
      this.log(me, 'Recording stopped')
    })
  }

  bag(name) {
    const b = this.g.bags.get(name || '')
    if (!b) throw `[ERROR] [ros2bag]: Bag path '${name || ''}' does not exist!`
    return b
  }

  bag_info(a) {
    const b = this.bag(a[0])
    const date = (s) => new Date(s * 1000).toString().slice(4, 24)
    const rows = [...b.types].map(
      ([t, type]) => `Topic: ${t} | Type: ${type} | Count: ${b.msgs.filter((m) => m.topic === t).length} | Serialization Format: cdr`,
    )
    this.print(
      [
        '',
        `Files:             ${b.name}_0.mcap`,
        `Bag size:          ${(JSON.stringify(b.msgs).length / 1048576).toFixed(1)} MiB`,
        'Storage id:        mcap',
        `Duration:          ${b.duration.toFixed(3)}s`,
        `Start:             ${date(b.start)} (${b.start.toFixed(3)})`,
        `End:               ${date(b.start + b.duration)} (${(b.start + b.duration).toFixed(3)})`,
        `Messages:          ${b.msgs.length}`,
        ...rows.map((r, i) => (i ? '                   ' : 'Topic information: ') + r),
        '',
      ].join('\n'),
    )
  }

  bag_play(a) {
    const loop = a.includes('-l') || a.includes('--loop')
    const b = this.bag(a.find((x) => !x.startsWith('-')))
    const node = this.g.node('rosbag2_player')
    const pubs = new Map([...b.types].map(([t, type]) => [t, node.pub(t, type, t === '/tf_static')]))
    this.hold(node)
    this.log('rosbag2_player', 'Press SPACE for Pause/Resume')
    this.log('rosbag2_player', 'Playback until timestamp: -1')
    let t0 = this.g.t
    let i = 0
    node.timer(0.01, () => {
      const t = this.g.now - t0
      for (; i < b.msgs.length && b.msgs[i].t <= t; i++) pubs.get(b.msgs[i].topic).publish(b.msgs[i].msg)
      if (t < b.duration) return
      if (!loop) return this.finish()
      t0 = this.g.now
      i = 0
    })
  }
}
