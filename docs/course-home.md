---
icon: lucide/book-open
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos**, robotics engineer at [Georgia Tech Research
    Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student
    at Georgia Tech researching autonomy behavior architectures.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/)
course at Georgia Tech centered around rapid robotics software prototyping.
Students pick a focus area and develop a full demo of a working program every
two weeks.

This course is about mobile robots in the real world: ground, water, and air
vehicles that have to navigate an unpredictable environment and then carry out a
long-horizon task. Not self-driving cars, not robot arms. Those live in
structured or controlled settings; the hard part here is staying reliable across
a long mission in a world that won't hold still.

## How the course works

### 1. Figure out what you're aiming at

Before you pick a track, research 5-10 companies with open job postings you'd
want and could plausibly get. Pull out the skills they're hiring for.
Cross-reference Glassdoor and levels.fyi.

The output is a list of skills you can name. Everything after this is you
building evidence for them, every two weeks, for a semester.

### 2. Pick a track

At the start, choose one of the four project areas below. This is the space you
work in for the semester. You're not committing to a single deliverable; you're
committing to a problem area.

**[Fusion in Motion](fusion-in-motion.md)** — Build repeatable sensor-fusion
experiments for moving robots. Work on sensor models, timing and faults,
estimators, datasets, or metrics that compare methods on the same measurements
and truth.

**[World Models](world-models.md)** — Try learned world models as the fast
low-level layer of a drone, with an LLM giving commands on top. Work on
reproducing recent papers, logging simulated flights, prediction on unseen
flights, or planning to a goal image. No repo yet.

**[isaacdrones](isaacdrones.md)** — Build a drone simulation on a small NVIDIA
Isaac Sim base. The physics loop and camera work, but there's no drone yet. Work
on the vehicle model, cameras, lidar or radar, the ROS 2 bridge, or a flight
stack.

**[splatsim](splatsim.md)** — Replay a drone's flight inside a Gaussian splat of
the place it flew through and score it against the log. Work on how far from the
capture a render can be trusted, poses from the log, detector-based scores, a
viewer, or other log formats. The most research-heavy track.

### 3. Ship something every two weeks

Work runs in two-week cycles. Each cycle you commit to one thing you can demo,
and you show it at the Wednesday sync. If you're on a subteam, you commit as a
team. Demoing is mandatory. A demo means it works in front of people: a running
node, a passing eval, a vehicle doing the thing in sim. Not slides, not a status
update.

If it flops, that's fine. You still get up, share your code, and talk through
it: what you were going for, where it broke, and why. A demo that fails and gets
explained is worth more than a status update that hides the failure. What isn't
acceptable is showing up with nothing.

When a cycle closes, that deliverable is done. You pick a new problem to work
on, still inside your track. Over a semester you stack up several distinct,
shipped pieces of work rather than one open-ended project that's perpetually
"almost there."

### 4. Background modules (optional)

Optional background reading for when you want to go deeper on a topic.

**Modules**:

1. **[C++ CLI tooling](cpp-cli-tooling.md)** — CMake fundamentals and the
   workflow to spin up a useful utility from scratch.

2. **[System design](system-design.md)** — how robotics services connect, why
   they run at different rates, and what happens when sensor data stops
   arriving.

... more coming soon ...
