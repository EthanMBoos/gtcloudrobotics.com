# gtcloudrobotics.com

Public site for **GT Cloud Robotics**, a Georgia Tech VIP course Ethan teaches (mobile-robot
autonomy infrastructure; students ship a demo every two weeks). Built with **Zensical**
(Material for MkDocs' successor). Live at https://gtcloudrobotics.com via GitHub Pages.

## How it builds

- Everything is `docs/*.md` + `zensical.toml`. **`site/` is generated output (gitignored) —
  never edit it.**
- Deploy is automatic: push to `main`/`master` → `.github/workflows/docs.yml` runs
  `pip install zensical && zensical build --clean` and publishes `site/` to Pages. Custom
  domain via `docs/CNAME`.
- Local preview: `pip install zensical && zensical serve` from the repo root.
- **Nav is explicit** in `zensical.toml` (`nav = [...]`) — a new page in `docs/` does not
  appear until it also gets a nav entry. Edit both together.

## Authoring conventions

- Frontmatter: `icon: lucide/<name>` on every page; `hide: [toc]` on narrative pages
  (about); module pages keep the ToC.
- Material markdown is enabled: admonitions (`!!! note`), grid cards, content tabs,
  `{ .md-button }`, mermaid fences, arithmatex, footnote tooltips. Images live in
  `docs/assets/images/`.
- Voice: direct, second person, no marketing fluff. Written for students ("a demo means it
  works in front of people; not slides"). Match it.
- `course-home.md` owns course logistics/policy — don't restate them on other pages.
- Module pages end with an **Assignment** section: template repo in the
  `github.com/gtcloudrobotics` org + autograder on push + the "enrolled GT students send me
  your GitHub username" line. Follow that shape for new modules.

## Content map

| Page | What it is |
|---|---|
| `index.md` | Hero landing (adds `home-page` body class via inline script) |
| `about.md` | The infrastructure argument: contracts between opaque autonomy and trusted parts |
| `course-home.md` | Course structure: tracks (Simulation / Behavior Tree / RL & VLA), 2-week demo cycles, logistics |
| `cpp-cli-tooling.md`, `system-design.md` | Background modules, each ending with an autograded assignment |
| `behavior-architectures.md` | Background module (no assignment) |
| `gaussian-fieldwork.md` | Open-ended student subteam exploring Gaussian-splat tools and best practices |

Modules 4–6 (multi-threading, frames & transforms, path & motion planning) are named on
`course-home.md` but **not yet written** — the numbered list there is the source of truth.

## Consistency with sibling repos

Assignment template repos are local siblings: `../satellite-temperature-monitor`,
`../air-traffic-control-tracker`.
