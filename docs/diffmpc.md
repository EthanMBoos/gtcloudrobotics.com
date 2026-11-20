---
icon: lucide/flask-conical
hide:
- toc
---

# diffmpc-drones

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/diffmpc-drones){ .md-button }

**diffmpc-drones** tunes a drone's model predictive controller by training it.
It is built on [DiffMPC](https://arxiv.org/abs/2510.06179), a solver from Toyota
Research Institute that returns the gradient of a controller's output with
respect to its cost weights and model parameters, so both can be adjusted by
gradient ascent on a reward. The repo flies a quadrotor to a hover and trains
the cost weights, and it runs on a laptop CPU.

```sh
uv run diffmpc-drones --train 10
```

The goal of this track is a controller that survives a disturbance (e.g., a wind
gust or a dropped payload) that a hand-tuned one does not. The DiffMPC authors
showed this for a car, which they trained to drift through water puddles where
the hand-tuned controller spun out.

The simulated drone is currently the same model the controller plans with, so
the controller has nothing to be robust to. The work therefore begins with a
separate simulator that has thrust limits and randomized mass, drag, and wind.
We then train the cost weights together with the mass and thrust the controller
assumes, and compare the trained controller with the starting one on a
disturbance that neither was trained on.

!!! note "Docs"

    The [README](https://github.com/EthanMBoos/diffmpc-drones#readme) covers
    everything else. Start with
    [TODO.md](https://github.com/EthanMBoos/diffmpc-drones/blob/main/docs/TODO.md)
    for open work.
