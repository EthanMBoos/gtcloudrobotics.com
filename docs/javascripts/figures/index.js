// Finds <figure data-figure="name"> on the page and mounts the matching
// module when it nears the viewport. scan() runs on every page change, so it
// also tears down figures whose page has been swapped out.

const registry = {
  noise: () => import('./fusion/noise.js'),
  fuse: () => import('./fusion/fuse.js'),
  drift: () => import('./fusion/drift.js'),
  'bearing-range': () => import('./fusion/bearing-range.js'),
  frames: () => import('./fusion/frames.js'),
  latency: () => import('./fusion/latency.js'),
  speed: () => import('./fusion/speed.js'),
  encode: () => import('./wm/encode.js'),
  step: () => import('./wm/step.js'),
  rollout: () => import('./wm/rollout.js'),
  plan: () => import('./wm/plan.js'),
  unseen: () => import('./wm/unseen.js'),
  rates: () => import('./wm/rates.js'),
  feedback: () => import('./control/feedback.js'),
  integral: () => import('./control/integral.js'),
  limit: () => import('./control/limit.js'),
  gain: () => import('./control/gain.js'),
  cascade: () => import('./control/cascade.js'),
  lqr: () => import('./control/lqr.js'),
  mpc: () => import('./control/mpc.js'),
  train: () => import('./control/train.js'),
}

const mounted = new Map() // element -> dispose

async function mount(el) {
  const load = registry[el.dataset.figure]
  if (!load) throw new Error('unknown figure: ' + el.dataset.figure)
  const [{ Fig }, mod] = await Promise.all([import('./lib.js'), load()])
  if (!el.isConnected) return
  const fig = new Fig(el)
  mounted.set(el, () => fig.dispose())
  try {
    mod.default(fig)
  } catch (err) {
    fig.dispose()
    throw err
  }
}

function fail(el, err) {
  console.error(err)
  const p = document.createElement('p')
  p.className = 'fig-error'
  p.textContent = 'This figure needs WebGL and could not start.'
  el.prepend(p)
}

export function scan() {
  for (const [el, dispose] of mounted) {
    if (el.isConnected) continue
    dispose()
    mounted.delete(el)
  }
  for (const el of document.querySelectorAll('figure[data-figure]')) {
    if (mounted.has(el)) continue
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        mount(el).catch((err) => fail(el, err))
      },
      { rootMargin: '100% 0px' },
    )
    io.observe(el)
    mounted.set(el, () => io.disconnect())
  }
}
