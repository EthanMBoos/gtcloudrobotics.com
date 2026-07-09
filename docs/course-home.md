---
icon: lucide/book-open
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos**, robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student at Georgia Tech researching hybrid autonomy behavior architectures.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/) course at Georgia Tech centered around rapid robotics software prototyping. Students pick a focus area and develop a full demo of a working program every two weeks.

This course is about mobile robots in the real world: ground, air, and water vehicles (UGV, UAV, USV) that have to navigate an unpredictable environment and then carry out a long-horizon task. Not self-driving cars, not robot arms. Those live in structured or controlled settings; the hard part here is staying reliable across a long mission in a world that won't hold still.

## How the course works

### 1. Pick a track

At the start, choose one of the three tracks below as your rough interest area: **Platform**, **LLM**, or **Autonomy**. This is the space you work in for the semester. You're not committing to a single deliverable; you're committing to a problem area.

### 2. Ship something every two weeks

Work runs in two-week cycles. Each cycle you commit to one thing you can demo, and you show it at the Wednesday sync. If you're on a subteam, you commit as a team. Demoing is mandatory. A demo means it works in front of people: a running node, a passing eval, a vehicle doing the thing in sim. Not slides, not a status update.

If it flops, that's fine. You still get up, share your code, and talk through it: what you were going for, where it broke, and why. A demo that fails and gets explained is worth more than a status update that hides the failure. What isn't acceptable is showing up with nothing.

When a cycle closes, that deliverable is done. You pick a new problem to work on, still inside your track. Over a semester you stack up several distinct, shipped pieces of work rather than one open-ended project that's perpetually "almost there."

### 3. Background modules (optional)

The modules below are optional background reading and context to build up a solid foundation. They're here when you want to go deeper on a topic.

Each one is deliberately close to a take-home technical interview: a scoped problem, tests to pass, automated grading. Attempts are unlimited. The goal is to learn the material, not to one-shot it under pressure. If you're stuck, bring it to the weekly sync.

**Modules** (I'm still finishing up the non-hyperlinked ones):

0. **[Reference Resources](reference-resources.md)** — A curated list of materials for anyone new to robotics development.

1. **[C++ CLI tooling](cpp-cli-tooling.md)** — CMake fundamentals and the workflow to spin up a useful utility from scratch.

2. **[System design](system-design.md)** — who owns what, where the boundaries go, and what a system should do when a sensor goes quiet.

3. **[Time alignment](time-alignment.md)** — making every clock and timestamp on a single robot agree, the foundation that sensor fusion, state estimation, and control loops silently depend on.

4. Multi-threading & concurrency — when concurrency actually helps, and how to dodge the classic pitfalls.

5. Frames & transforms — converting between local and global frames, body and world, and LLA to ENU.

6. Path & motion planning — generating feasible trajectories through space and time.

7. **[Behavior architectures & autonomy](behavior-architectures.md)** — composing behavior with state machines, behavior trees, and planners.

## The tracks

Platform is the structured track; the other two are open-ended.

**Platform.** This is the work I do for my own PhD, so unlike the pick-your-own-problem tracks it comes with clear, rigorous tasking and direction. If you'd rather go deep on well-scoped problems in a real system than scope your own from scratch, come here: tell me what you find interesting and I'll carve off a piece. See [Tower](tower.md), [Pidgin](pidgin.md), [SPAR](spar.md).

**LLM.** Making a language model trustworthy enough to command a real vehicle. Two modes: turning a non-expert's plain-language description of a complex job into something a robot can run, and checking every live command against what the vehicle can actually do and safely do before it fires. A hallucination in a chat window is a nuisance; a hallucinated command to a vehicle isn't. Figuring out how to make it reliable is the work, and most of it is unsolved.

**Autonomy.** Pick your own application and build a complete, vertically-integrated autonomy stack behind it. Any vehicle, any language, any problem area (search & rescue, agriculture, logistics, construction, environmental monitoring, etc). Build the full system from perception to the behavior that drives the vehicle.

## Course logistics

**Weekly sync / demo day: Wednesdays at 5 PM, in person.** We meet every week in Klaus. Every other week is demo day. You demo what you committed to. Off-week syncs are for getting unstuck, getting feedback on in-progress work, and lining up your next cycle. Attendance is the default expectation, but I'm flexible: if you need to miss for a test, illness, or something else real, just let me know ahead of time.

