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

The prose on these two pages, and on the three track pages, follows the plain, deductive
style of the π0.5 paper (arXiv 2504.16054), not the casual voice of the older
pages. Prefer paragraphs to bulleted lists, including for roadmaps. Each
section opens with the general statement, motivated by the section before it,
then the figure, then what the figure shows and the conclusion that follows.
Write complete declarative sentences in the first person plural ("we refer to
this as drift"), define each term where it is first used, give concrete cases
in parentheses with "e.g.,", and state causes explicitly ("because", "so",
"therefore"). No rhetorical questions, aphorisms, or one-line punchy
paragraphs. Captions say what each color or panel is.

Their page titles are just "Sensor Fusion" and "World Models"; the nav label
for each is "Intro".

The other pages in each folder are deep dives into one specific topic. In the
nav each folder is a group with a plain, non-clickable heading ("Sensor
fusion", "World models"), then the explainer labeled "Intro", then "Background", then any
deep dives. Don't name the intro `index.md`: with `navigation.indexes` on, that
turns the group heading into a link to it.

- A figure is `<figure class="fig" data-figure="NAME">` in the markdown, plus a
  module in `docs/javascripts/figures/{fusion,wm}/NAME.js` (the sensor fusion background page's figures are in `fusion/` too, with shared solvers in `fusion/lsq.js`) that default-exports
  `mount(fig)`, plus an entry in the registry in `figures/index.js`.
- `figures/lib.js` is the shared harness: `Stage` (renderer, orbit camera,
  labels, insets), `Fig` (sliders, toggles, buttons, readout, chart), meshes
  (`rover`, `drone`, `Ribbon`, `Ellipse`, `Surface`, `Arrow`), and the palette
  `C`. Colors mean the same thing in every figure: dark = truth, blue =
  estimate or prediction, red = measurement or error, teal = goal, brass =
  secondary. `extra.css` repeats those hex values for labels.
- Planar sims use `(x, y)`; meshes map that to three.js `(x, height, y)`.
- three.js r170 and OrbitControls are vendored in `docs/javascripts/vendor/`.
  No bundler, no CDN. `extra.js` imports `figures/index.js` on every page
  change (instant navigation), which mounts figures lazily and disposes the
  ones that left the page.
- The world-model figures run a toy (`figures/wm/world.js`), not a trained
  model. Say so in the caption when a figure could be mistaken for one.

## How a Background page is made

`sensor-fusion/background.md` is the model, and `world-models/background.md`
was built the same way. Its figures are in `figures/wm/` (`exploit`, `branch`,
`horizon`, `residual`, `coverage`, `chunks`, `collapse`, `aux`, `rank`) and skip what the intro
page already animates; points whose mechanism the intro covers link to it
instead of getting a figure.

**1. Research first, and report before building.** Use the deep-research skill
with about five parallel researchers at high effort, split so they don't
overlap: the foundational era, the main algorithm lineage, each application
domain (road vehicles, drones) separately, and the current state plus
maintained open-source projects. Tell every researcher to verify years and
citations against primary sources, to flag disputed dates, to check repository
maintenance from the repository itself, and to add one sentence per moment on
what an interactive figure could show. A writer pass turns the notes into
`reports/<title>.md` with a shortlist of 10 to 14 timeline points, the strong
candidates left off, a current-state section, and a list of what could not be
verified. Then give Ethan a short report-out (the shortlist table, where the
field is now, what isn't solid, and the decisions that are his) and wait for
his direction before writing the page.

**2. Page shape.** Intro paragraph (what the page covers; say that the figures
are toy simulations), then the timeline, then one short prose section for the
old history with no figures, then six to eight figure sections, then "Where
the field is now" (two or three paragraphs, a table of maintained projects,
and a few free texts). Keep the ToC. Ethan's direction: the page gives the
brief full history, but the figures go to the recent ideas that build up to
what students need to think about now, not the oldest material.

**3. Timeline.** One horizontal strip of every shortlisted point: raw HTML
`<div class="tl">` with one `.tl-item` per point (year, name, a note of six
words or fewer), a lane class for the dot color, and a `.tl-key` legend. Points
that have a figure section link to it. Give those sections explicit ids
(`## Title { #id }`). Print the usual citation year.

**4. Each figure section.** A paragraph that states the problem the previous
method left, names the idea, defines its term, and links the primary paper;
the figure with a caption saying what each color is and what each control
does; then a paragraph on what the figure shows, with numbers, and the
conclusion or limit that follows. Where it is true, tie the section to a course
track (e.g., ripple and GTSAM).

**5. Each figure.** Pick the one mechanism to show and the one or two controls
that break or fix it. Write the simulation as an exported class or pure
functions, separate from `mount(fig)`, so that node can import and test it.
Before drawing anything, run it over many seeds and check that it shows what
the text will claim; when it doesn't, change the scenario or drop the claim, and
never fake the effect. Numbers quoted in the prose come from those runs. Prefer
a simplification that keeps the maths exact (e.g., a linear problem) over a
faithful model that needs tuning, and state the simplification in the caption.
Reuse `fusion/ekf.js` and `fusion/lsq.js` (linear solve, planar least squares,
Gauss-Newton, constant-velocity Kalman filter) where they fit. Run both
variants on the same data when the figure compares two methods.

**6. Check by looking.** `zensical build --clean`, serve `site/` with
`python3 -m http.server`, and screenshot each figure in headless Chrome
(`--headless=new --enable-unsafe-swiftshader --virtual-time-budget=9000`) with
`?warp=N` to pre-roll N seconds. A one-figure test page dropped into `site/`
works better than anchors on the long page, which screenshot blank. Clear the
Chrome profile between runs, because it caches the modules. `Ribbon.set` reads
a third element of each point as height, so pass it `[x, y]` pairs. Planar `+y`
is toward the viewer (the bottom of the screen) in the default camera, which
matters for left and right turns and for canvas textures on the ground.

## Content map

| Page | What it is |
|---|---|
| `index.md` | Hero landing (adds `home-page` body class via inline script) |
| `course-home.md` | Course structure: project tracks, 2-week demo cycles, logistics, and links to the two intro pages |
| `sensor-fusion/intro.md` | Intro explainer: noise, predict/update, drift, bearing/range, frames, latency, speed |
| `world-models/intro.md` | Intro explainer: latent, prediction, rollouts, planning, unseen flights, two-layer stack |
| `sensor-fusion/background.md` | Brief history: a horizontal timeline of 14 points (`.tl` in `extra.css`), a short prose history, six figure sections on the recent ideas (association, pose graph, visual-inertial, map localization, factor graphs, SLAMMOT), then current state and maintained open-source projects. Sources are in `reports/Sensor fusion history for AVs and drones.md` |
| `world-models/background.md` | Brief history, same shape as the sensor fusion one: a timeline of 16 points in four lanes (the fourth is manipulation, `.tl-arm`), a short prose history, nine figure sections on the ideas from 2018 onward (exploitation, branching futures, horizon and value, learned residual, reconstruction coverage, action chunks under a slow layer, embedding collapse, video prediction as a training signal, ranking with an imperfect evaluator), then current state with a table of slow-layer and fast-layer designs and maintained open-source projects. Sources are in `reports/World model history for AVs and drones.md` and `reports/World models in manipulation robotics.md` |
| `ripple.md`, `isaacdrones.md`, `splatsim.md` | Project track pages, one per repo, kept short: one paragraph on what it is, one command, a "Working up to …" section of two paragraphs, and a Docs note. The repo holds the detail. Each has a matching blurb on `course-home.md` |

The course splits conceptually into classical sensor fusion and learned world
models; the two intro pages follow that split and are linked from
`course-home.md`.

## Consistency with sibling repos

Assignment template repos are local siblings:
`../satellite-temperature-monitor`, `../air-traffic-control-tracker`. Project
repos are siblings too (`../ripple`, `../isaacdrones`, `../splatsim`); their READMEs and
`docs/` are the source for the project pages.
