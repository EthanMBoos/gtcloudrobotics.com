---
icon: lucide/git-merge
hide:
- toc
---

# onegraph

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/onegraph){ .md-button }

**onegraph** estimates a drone's state and plans its controls in a single factor
graph. It is a riff on Frank Dellaert's post [Factor Graphs and "World
Models"](https://gtsam.org/2026/04/21/factor-graphs-and-world-models.html), in
which the past few seconds of the graph are a smoother and the next few are a
model predictive controller. The repo is a stub: it flies a planar point mass to
a goal, once with the joint graph and once with a separate estimator and
controller.

```sh
uv run onegraph
```

The goal of this track is a drone that keeps flying in conditions it was not
tuned for (e.g., a degraded sensor or a gust of wind), where a separately tuned
estimator and controller do not.

Most of the design is open. The options we are thinking about include whether
the two halves are solved together or the estimate is solved first and handed to
the plan, whether wind is a state that the past half estimates and the future
half plans with, whether the dynamics are written by hand or learned from
flights, and whether the plan is found by optimization or by
[sampling](https://github.com/borglab/gtsam/pull/2936).

!!! note "Docs"

    The [README](https://github.com/EthanMBoos/onegraph#readme) covers
    everything else. Start with Dellaert's post and
    [TODO.md](https://github.com/EthanMBoos/onegraph/blob/main/docs/TODO.md)
    for open work.
