# gtcloudrobotics.com

Public site for **GT Cloud Robotics**, a Georgia Tech VIP course Ethan teaches
(mobile-robot autonomy infrastructure; students ship a demo every two weeks).
Built with **Zensical** (Material for MkDocs' successor). Live at
https://gtcloudrobotics.com via GitHub Pages.

## How it builds

- Everything is `docs/*.md` + `zensical.toml`. **`site/` is generated output
  (gitignored) — never edit it.**
- Deploy is automatic: push to `main`/`master` → `.github/workflows/docs.yml`
  runs `pip install zensical && zensical build --clean` and publishes `site/` to
  Pages. Custom domain via `docs/CNAME`.
- Local preview: `pip install zensical && zensical serve` from the repo root.
- **Nav is explicit** in `zensical.toml` (`nav = [...]`) — a new page in `docs/`
  does not appear until it also gets a nav entry. Edit both together.

## Authoring conventions

- Frontmatter: `icon: lucide/<name>` on every page; project pages hide the
  ToC; the two intro pages keep it.
- The site is light mode only. The home page hero sets itself to `slate` in
  `docs/javascripts/extra.js`; nothing else should.
- Material markdown is enabled: admonitions (`!!! note`), grid cards, content
  tabs, `{ .md-button }`, mermaid fences, arithmatex, footnote tooltips. Images
  live in `docs/assets/images/`.
- Voice: direct, second person, no marketing fluff. Written for students ("a
  demo means it works in front of people; not slides"). Casual and opinionated
  is welcome when the opinion is tied to a concrete tradeoff.
- Lead with what the reader can do or understand. Prefer a concrete example
  before a general rule, short paragraphs, natural unnumbered headings, and
  plain statements of current limits.
- Qualify rates, defaults, and design advice when they depend on the robot or
  project. Cut textbook throat-clearing, repeated setup, unnecessary bolding,
  universal claims, unnecessary intensifiers, and sentences that mainly try to
  sound authoritative.
- `course-home.md` owns course logistics/policy — don't restate them on other
  pages.
- When a page has an assignment, end with an **Assignment** section and link
  the template repository and local/CI checks. None do yet.

## Intro pages, background pages, and figures

`sensor-fusion/intro.md` and `world-models/intro.md` are the top-level
page for each half of the course: long single-page explainers in the style of
https://glinscott.github.io/beam-engine/, with one `##` section per idea, an
interactive three.js figure in each, and a short paragraph before and after it.

The prose on these two pages, and on the four track pages, follows the plain, deductive
style of the π0.5 paper (arXiv 2504.16054), not the casual voice of the older
pages. Prefer paragraphs to bulleted lists, including for roadmaps. Each
section opens with the general statement, motivated by the section before it,
then the figure, then what the figure shows and the conclusion that follows.
Write complete declarative sentences in the first person plural ("we refer to
this as drift"), define each term where it is first used, give concrete cases
in parentheses with "e.g.,", and state causes explicitly ("because", "so",
"therefore"). No rhetorical questions, aphorisms, or one-line punchy
paragraphs. Captions say what each colour or panel is.

Their page titles are just "Sensor Fusion" and "World Models"; the nav label
for each is "Intro".

The other pages in each folder are deep dives into one specific topic. In the
nav each folder is a group with a plain, non-clickable heading ("Sensor
fusion", "World models"), then the explainer labelled "Intro", then "Background", then any
deep dives. Don't name the intro `index.md`: with `navigation.indexes` on, that
turns the group heading into a link to it.

- A figure is `<figure class="fig" data-figure="NAME">` in the markdown, plus a
  module in `docs/javascripts/figures/{fusion,wm}/NAME.js` that default-exports
  `mount(fig)`, plus an entry in the registry in `figures/index.js`.
- `figures/lib.js` is the shared harness: `Stage` (renderer, orbit camera,
  labels, insets), `Fig` (sliders, toggles, buttons, readout, chart), meshes
  (`rover`, `drone`, `Ribbon`, `Ellipse`, `Surface`, `Arrow`), and the palette
  `C`. Colours mean the same thing in every figure: dark = truth, blue =
  estimate or prediction, red = measurement or error, teal = goal, brass =
  secondary. `extra.css` repeats those hex values for labels.
- Planar sims use `(x, y)`; meshes map that to three.js `(x, height, y)`.
- three.js r170 and OrbitControls are vendored in `docs/javascripts/vendor/`.
  No bundler, no CDN. `extra.js` imports `figures/index.js` on every page
  change (instant navigation), which mounts figures lazily and disposes the
  ones that left the page.
- The world-model figures run a toy (`figures/wm/world.js`), not a trained
  model. Say so in the caption when a figure could be mistaken for one.

## Content map

| Page | What it is |
|---|---|
| `index.md` | Hero landing (adds `home-page` body class via inline script) |
| `course-home.md` | The premise (one multi-semester project), then three focus areas (sensor fusion with ripple, control with diffmpc-drones, learning with isaacdrones and splatsim), each with the one problem Ethan wants solved and why, then the 2-week demo cycle. Links the two intro pages |
| `sensor-fusion/intro.md` | Intro explainer: noise, predict/update, drift, bearing/range, frames, latency, speed |
| `world-models/intro.md` | Intro explainer: latent, prediction, rollouts, planning, unseen flights, two-layer stack |
| `background.md` in those two folders | Background for each half: a short timeline of techniques, then the current state and the top open-source resources and approaches. Currently a stub saying so; Ethan plans to write them |
| `ripple.md`, `isaacdrones.md`, `splatsim.md` | Project track pages, one per repo, kept short: one paragraph on what it is, one command, two paragraphs on the goal and the work ahead (no heading), and a Docs note. The repo holds the detail. Each has a matching blurb on `course-home.md` |
| `diffmpc.md` | Project track page for the `diffmpc-drones` repo (DiffMPC from Toyota Research Institute, on drones), in the same shape as the other three. DiffMPC is CC BY-NC-ND, so the repo uses it as an unmodified submodule |

The course splits conceptually into classical sensor fusion and learned world
models; the two intro pages follow that split and are linked from
`course-home.md`.

## Consistency with sibling repos

Assignment template repos are local siblings:
`../satellite-temperature-monitor`, `../air-traffic-control-tracker`. Project
repos are siblings too (`../ripple`, `../isaacdrones`, `../splatsim`, `../diffmpc-drones`); their READMEs and
`docs/` are the source for the project pages.
