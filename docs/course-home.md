---
icon: lucide/book-open
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos**, robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student at Georgia Tech researching hybrid autonomy behavior architectures.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/) course at Georgia Tech centered around rapid robotics software prototyping. Students pick a focus area and develop a full demo of a working program every two weeks.

This course is about mobile robots in the real world: air and ground vehicles that have to navigate an unpredictable environment and then carry out a long-horizon task. Not self-driving cars, not robot arms. Those live in structured or controlled settings; the hard part here is staying reliable across a long mission in a world that won't hold still.

## How the course works

### 1. Figure out what you're aiming at

Before you pick a track, research 5-10 companies with open job postings you'd want and could plausibly get. Pull out the skills they're hiring for. Cross-reference Glassdoor and levels.fyi. My prediction is in the [slide 5 of the syllabus deck](https://docs.google.com/presentation/d/1y0O1_-Wkozg2WZw5zR-AYKrOTz60Ur8x-tx7RLZLKpc/edit?usp=sharing); check it against what you actually find.

The output is a list of skills you can name. Everything after this is you building evidence for them, every two weeks, for a semester.

### 2. Pick a track

At the start, choose one of the three tracks below as your rough interest area. This is the space you work in for the semester. You're not committing to a single deliverable; you're committing to a problem area. All three tracks build on [SPAR](https://github.com/EthanMBoos/spar), the course's simulation and autonomy starter repo.

**MuJoCo Robotics Simulation** — Build and evaluate the worlds used by the other tracks. SPAR's current pipeline uses BlenderMCP to turn a text brief into an editable 40×40 m scene with detailed render geometry, semantic sites, and explicit collision proxies. An exporter converts the accepted scene into OBJ and PNG assets, MJCF, and optional ground and air waypoint files, then checks the artifact and compiles it in MuJoCo. Extend that pipeline, author new test environments, and measure how each world changes autonomy behavior.

**Behavior Tree Autonomy Platform** — Long-horizon autonomy for a robot working unsupervised. You own the behavior layer above the vehicle's motion controller (Nav2 on the ground, PX4 in the air): mission logic, docking when the battery runs low, deciding what to do with what perception reports. Come up with a mission and make the robot do it end to end.

**RL & VLA Learning Integration** — Bring learned models into the stack. SPAR has the swap points: train a policy in a pure-MuJoCo loop and run it as a behavior node, or put a VLM behind the perception topic. Then evaluate it against the hand-written tree.


### 3. Ship something every two weeks

Work runs in two-week cycles. Each cycle you commit to one thing you can demo, and you show it at the Wednesday sync. If you're on a subteam, you commit as a team. Demoing is mandatory. A demo means it works in front of people: a running node, a passing eval, a vehicle doing the thing in sim. Not slides, not a status update.

If it flops, that's fine. You still get up, share your code, and talk through it: what you were going for, where it broke, and why. A demo that fails and gets explained is worth more than a status update that hides the failure. What isn't acceptable is showing up with nothing.

When a cycle closes, that deliverable is done. You pick a new problem to work on, still inside your track. Over a semester you stack up several distinct, shipped pieces of work rather than one open-ended project that's perpetually "almost there."

### 4. Background modules (optional)

The modules below are optional background reading and context to build up a solid foundation. They're here when you want to go deeper on a topic.

Each one is deliberately close to a take-home technical interview: a scoped problem, tests to pass, and CI that grades every push. If you're stuck, bring it to the weekly sync.

**Modules**:

1. **[C++ CLI tooling](cpp-cli-tooling.md)** — CMake fundamentals and the workflow to spin up a useful utility from scratch.

2. **[System design](system-design.md)** — who owns what, where the boundaries go, and what a system should do when a sensor goes quiet.

3. **[Behavior architectures & autonomy](behavior-architectures.md)** — composing behavior with state machines, behavior trees, and planners.

... more coming soon ...

## Course logistics

Weekly sync / demo day: Wednesdays at 5 PM, in person.

We meet every week in Klaus. Every other week is demo day. You demo what you committed to. Off-week syncs are for getting unstuck, getting feedback on in-progress work, and lining up your next cycle. Attendance is the default expectation, but I'm flexible: if you need to miss for a test, illness, or something else real, just let me know ahead of time.
