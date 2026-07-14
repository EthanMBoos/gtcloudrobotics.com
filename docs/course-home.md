---
icon: lucide/book-open
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos**, robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student at Georgia Tech researching hybrid autonomy behavior architectures.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/) course at Georgia Tech centered around rapid robotics software prototyping. Students pick a focus area and develop a full demo of a working program every two weeks.

This course is about mobile robots in the real world: ground, air, and water vehicles (UGV, UAV, USV) that have to navigate an unpredictable environment and then carry out a long-horizon task. Not self-driving cars, not robot arms. Those live in structured or controlled settings; the hard part here is staying reliable across a long mission in a world that won't hold still.

That's a software problem, so we work in simulation. You won't touch hardware. Getting a robot's hardware working is a grind, but it's a known grind, and it isn't what I'm interested in here. What's not known is how you stop a bad command from reaching a vehicle, whether an operator, a state machine, or a learned policy produced it. That's the problem this course is pointed at.

[Syllabus week slide deck.](https://docs.google.com/presentation/d/1y0O1_-Wkozg2WZw5zR-AYKrOTz60Ur8x-tx7RLZLKpc/edit?usp=sharing)

## How the course works

### 1. Figure out what you're aiming at

Before you pick a track, pick 5-10 companies with postings you'd want and could plausibly get. Pull out the skills they're hiring for. Cross-reference Glassdoor and levels.fyi. My prediction is in the [deck (slide 5)](https://docs.google.com/presentation/d/1y0O1_-Wkozg2WZw5zR-AYKrOTz60Ur8x-tx7RLZLKpc/edit?usp=sharing); check it against what you actually find.

The output is a list of skills you can name. Everything after this is you building evidence for them, every two weeks, for a semester.

### 2. Pick a track

At the start, choose one of the three tracks below as your rough interest area: **Autonomy**, **LLM**, or **Platform**. This is the space you work in for the semester. You're not committing to a single deliverable; you're committing to a problem area. Autonomy and LLM are open-ended; Platform is structured and isn't open to first-semester students.

### 3. Ship something every two weeks

Work runs in two-week cycles. Each cycle you commit to one thing you can demo, and you show it at the Wednesday sync. If you're on a subteam, you commit as a team. Demoing is mandatory. A demo means it works in front of people: a running node, a passing eval, a vehicle doing the thing in sim. Not slides, not a status update.

If it flops, that's fine. You still get up, share your code, and talk through it: what you were going for, where it broke, and why. A demo that fails and gets explained is worth more than a status update that hides the failure. What isn't acceptable is showing up with nothing.

When a cycle closes, that deliverable is done. You pick a new problem to work on, still inside your track. Over a semester you stack up several distinct, shipped pieces of work rather than one open-ended project that's perpetually "almost there."

### 4. Background modules (optional)

The modules below are optional background reading and context to build up a solid foundation. They're here when you want to go deeper on a topic.

Each one is deliberately close to a take-home technical interview: a scoped problem, tests to pass, automated grading. Attempts are unlimited. The goal is to learn the material, not to one-shot it under pressure. If you're stuck, bring it to the weekly sync.

**Modules** (I'm still finishing up the non-hyperlinked ones):

1. **[C++ CLI tooling](cpp-cli-tooling.md)** — CMake fundamentals and the workflow to spin up a useful utility from scratch.

2. **[System design](system-design.md)** — who owns what, where the boundaries go, and what a system should do when a sensor goes quiet.

3. **[Time alignment](time-alignment.md)** — making every clock and timestamp on a single robot agree, the foundation that sensor fusion, state estimation, and control loops silently depend on.

4. Multi-threading & concurrency — when concurrency actually helps, and how to dodge the classic pitfalls.

5. Frames & transforms — converting between local and global frames, body and world, and LLA to ENU.

6. Path & motion planning — generating feasible trajectories through space and time.

7. **[Behavior architectures & autonomy](behavior-architectures.md)** — composing behavior with state machines, behavior trees, and planners.

## The tracks

**Autonomy.** Pick your own application and build a complete, vertically-integrated autonomy stack behind it. Any vehicle, any language, any problem area. Two ways to start: [kickstart-autonomy](https://github.com/EthanMBoos/kickstart-autonomy), a ROS2 + Nav2 ground Husky I threw together so you can skip the config and get to the interesting layer on day one. Nothing precious about it, rip it apart if you want. Or from scratch, which is harder and more fun. Bolt on a VLM, try a learned policy; that's a good cycle. But six cycles of "the model saw the thing" is not a stack.

**LLM.** Making a language model trustworthy enough to command a real vehicle. Two modes: turning a non-expert's plain-language description of a complex job into something a robot can run, and checking every live command against what the vehicle can actually do and safely do before it fires. A hallucination in a chat window is a nuisance; a hallucinated command to a vehicle isn't. Your target is the [kickstart-autonomy](https://github.com/EthanMBoos/kickstart-autonomy) Husky. Expect the work to split three ways: prompting and model strategy, Gazebo scenarios that stress what a model can actually understand, and the infrastructure to run it at scale (Ollama locally, or [PACE](https://pace.gatech.edu/)). Every demo produces a number. Fifty scenarios is a weekend of clicking; thousands is where the interesting failures live.

**Platform.** This is the work I do for my own PhD, so unlike the pick-your-own-problem tracks it comes with clear, rigorous tasking and direction. If you'd rather go deep on well-scoped problems in something that's actively being built than scope your own from scratch, come here: tell me what you find interesting and I'll carve off a piece. See [Tower](https://github.com/EthanMBoos/Tower), [Pidgin](https://www.gtcloudrobotics.com/pidgin/), [SPAR](https://www.gtcloudrobotics.com/spar/). I'm on a publication timeline, so I can't teach the basics in this track. It's not a judgment about anyone, I just don't have the hours to hand-hold here. So it isn't open in your first semester. Ship in Autonomy or LLM, demo every two weeks, and I'll see what you can do. Then we talk.

## Course logistics

**Weekly sync / demo day: Wednesdays at 5 PM, in person.** We meet every week in Klaus. Every other week is demo day. You demo what you committed to. Off-week syncs are for getting unstuck, getting feedback on in-progress work, and lining up your next cycle. Attendance is the default expectation, but I'm flexible: if you need to miss for a test, illness, or something else real, just let me know ahead of time.

