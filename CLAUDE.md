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

- Frontmatter: `icon: lucide/<name>` on every page; narrative project pages hide the
  ToC; module pages keep it.
- Material markdown is enabled: admonitions (`!!! note`), grid cards, content tabs,
  `{ .md-button }`, mermaid fences, arithmatex, footnote tooltips. Images live in
  `docs/assets/images/`.
- Voice: direct, second person, no marketing fluff. Written for students ("a demo means it
  works in front of people; not slides"). Casual and opinionated is welcome when the
  opinion is tied to a concrete tradeoff.
- Lead with what the reader can do or understand. Prefer a concrete example before a
  general rule, short paragraphs, natural unnumbered headings, and plain statements of
  current limits.
- Qualify rates, defaults, and design advice when they depend on the robot or project.
  Cut textbook throat-clearing, repeated setup, unnecessary bolding, universal claims,
  unnecessary intensifiers, and sentences that mainly try to sound authoritative.
- `course-home.md` owns course logistics/policy — don't restate them on other pages.
- When a module has an assignment, end with an **Assignment** section and link the
  template repository and local/CI checks. Not every background module needs one.

## Content map

| Page | What it is |
|---|---|
| `index.md` | Hero landing (adds `home-page` body class via inline script) |
| `course-home.md` | Course structure: three project areas, 2-week demo cycles, logistics |
| `cpp-cli-tooling.md` | Background module ending with an autograded assignment |
| `system-design.md`, `behavior-architectures.md` | Background modules (no assignment) |
| `gaussian-fieldwork.md` | Open-ended student subteam exploring Gaussian-splat tools and best practices |

Modules 4–6 (multi-threading, frames & transforms, path & motion planning) are named on
`course-home.md` but **not yet written** — the numbered list there is the source of truth.

## Consistency with sibling repos

Assignment template repos are local siblings: `../satellite-temperature-monitor`,
`../air-traffic-control-tracker`.
