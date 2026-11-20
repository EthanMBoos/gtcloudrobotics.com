---
icon: lucide/waves
hide:
- toc
---

# ripple

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/ripple){ .md-button }

**ripple** is a simulator for multi-agent robot missions. It maintains two
states for every vehicle: the truth, which is where the vehicle actually is, and
the belief, which is where its software estimates it to be. Autonomy and control
read only the belief, so an error in the estimate changes the path that the
vehicle actually flies. This makes ripple well suited to sensor fusion
experiments on drones.

```sh
cargo install --path crates/cli --locked
ripple run crates/starter/missions/position-kalman.yaml --viewer
```

The long-term goal of this track is SLAMMOT: simultaneous localization, mapping,
and moving object tracking, in which a single estimator determines where the
drone is, what the static environment looks like, and where the other moving
objects are.

ripple already provides a localization estimator, a tracking estimator, and a
factor-graph library (GTSAM). What it lacks is most of the sensing, so the work
begins there, with a range-and-bearing sensor and an inertial sensor. Mapping
and data association follow, and the final step combines all three problems in
one factor graph that we can compare with separate localization and tracking on
the same seeds.

!!! note "Docs"

    The [README](https://github.com/EthanMBoos/ripple#readme) and the book in
    the repository cover everything else. Start with
    [belief vs truth](https://github.com/EthanMBoos/ripple/blob/main/book/src/concepts/belief-vs-truth.md)
    and
    [your first localization estimator](https://github.com/EthanMBoos/ripple/blob/main/book/src/tutorial/noisy-localization.md).
