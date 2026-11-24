// The terminal under a figure: tabs, each with its own Shell, plus the list of
// commands to type. Output is buffered and written once per frame by flush().

import { Shell } from './cli.js'

const MAX_LINES = 400

function h(tag, cls, text) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text != null) el.textContent = text
  return el
}

export function terminal(fig, graph, { tabs = 2, commands = [] } = {}) {
  const box = h('div', 'fig-term')
  const bar = h('div', 'fig-term-bar')
  const stop = h('button', 'fig-term-stop', 'Ctrl-C')
  stop.type = 'button'
  const out = h('pre', 'fig-term-out')
  const line = h('label', 'fig-term-line')
  const prompt = h('span', '', '$')
  const input = h('input')
  Object.assign(input, { type: 'text', spellcheck: false, autocomplete: 'off', autocapitalize: 'off' })
  input.setAttribute('aria-label', 'terminal input')
  line.append(prompt, input)
  box.append(bar, out, line)

  let active = 0
  const terms = Array.from({ length: tabs }, (_, i) => {
    const t = { lines: [], dirty: true, history: [], at: 0, shell: null, tab: h('button', 'fig-term-tab', 'terminal ' + (i + 1)) }
    t.tab.type = 'button'
    t.tab.addEventListener('click', () => show(i, true))
    bar.append(t.tab)
    const write = (l) => {
      if (l === null) t.lines = []
      else t.lines.push(l)
      if (t.lines.length > MAX_LINES) t.lines.splice(0, t.lines.length - MAX_LINES)
      t.dirty = true
    }
    t.write = write
    t.shell = new Shell(graph, write, sync)
    return t
  })
  if (tabs < 2) terms[0].tab.disabled = true
  bar.append(stop)

  function sync() {
    const t = terms[active]
    prompt.textContent = t.shell.busy ? ' ' : '$'
    stop.hidden = !t.shell.busy
    input.placeholder = t.shell.raw ? 'keys go to the node; Ctrl-C to quit' : ''
    terms.forEach((x, i) => {
      x.tab.setAttribute('aria-pressed', i === active)
      x.tab.classList.toggle('busy', x.shell.busy)
    })
  }

  function show(i, focus) {
    active = i
    terms[i].dirty = true
    sync()
    if (focus) input.focus({ preventScroll: true })
  }

  function run(text) {
    const t = terms[active]
    t.write('$ ' + text)
    if (text.trim()) t.history.push(text)
    t.at = t.history.length
    t.shell.exec(text)
    sync()
  }

  function interrupt() {
    const t = terms[active]
    if (t.shell.busy) t.write('^C')
    t.shell.interrupt()
    sync()
  }

  input.addEventListener('keydown', (e) => {
    const t = terms[active]
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      return interrupt()
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Tab') {
      if (e.shiftKey || t.shell.busy || !input.value) return // leave Tab for moving focus
      e.preventDefault()
      input.value = t.shell.complete(input.value)
      return
    }
    if (t.shell.busy) {
      e.preventDefault()
      if (t.shell.raw && e.key.length === 1) t.shell.key(e.key)
      return
    }
    if (e.key === 'Enter') {
      const text = input.value
      input.value = ''
      run(text)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      t.at = Math.min(t.history.length, Math.max(0, t.at + (e.key === 'ArrowUp' ? -1 : 1)))
      input.value = t.history[t.at] || ''
    }
  })
  stop.addEventListener('click', () => {
    interrupt()
    input.focus({ preventScroll: true })
  })
  out.addEventListener('click', () => {
    if (!String(getSelection())) input.focus({ preventScroll: true })
  })

  fig.extra.append(box)

  if (commands.length) {
    const list = h('div', 'fig-try')
    list.append(h('span', '', 'Type in the terminal:'))
    for (const c of commands) list.append(h('code', '', c))
    fig.el.prepend(list) // above the scene, so it stays in view with the terminal
  }

  sync()
  return {
    flush() {
      const t = terms[active]
      if (!t.dirty) return
      t.dirty = false
      out.textContent = t.lines.join('\n')
      out.scrollTop = out.scrollHeight
    },
  }
}
