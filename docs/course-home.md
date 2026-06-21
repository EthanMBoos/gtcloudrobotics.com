---
icon: lucide/book-open
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos**, robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student at Georgia Tech researching hybrid autonomy behavior architectures.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/) course at Georgia Tech. You contribute to open-source robotics project repos and work through problems you'll actually see as a robotics engineer.

**The course is fully open.** All assignment repos live in [github.com/gtcloudrobotics](https://github.com/gtcloudrobotics) and the same path works whether you're enrolled at GT or not. Click **Use this template** on any assignment repo and push commits; the autograder runs on every push via GitHub Actions, and you can see pass/fail in the Actions tab. PRs into the subteam project repos are welcome from anyone; open an issue on the target repo first to scope the work. Anything below about the weekly sync or semester pacing is enrolled-specific.

## 1. Three autograded assignments

Complete three assignments over the semester. These aren't synthetic homework. I wrote each one from problems I've actually encountered: some drawn from technical interviews at hard-tech robotics companies, others from real issues I'm working through as a robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/). The format is deliberately close to a take-home technical interview: a scoped problem, tests to pass, automated grading. That's where a lot of you will first see problems like these. **Attempts are unlimited.** The goal is to learn the material, not to one-shot it under pressure. If you're stuck, bring it to the weekly sync (see below).

### First semester: all three required

1. **[C++ CLI tooling](cpp-cli-tooling.md)**: CMake fundamentals and the workflow to spin up a useful utility from scratch.
2. **[System design](system-design.md)**: the top-level view of a robotics stack: how sensors, controllers, planners, and autonomy modules fit together, and why each runs at a different rate (controller in the kHz range, perception at camera fps, planner slower still). The mental model the rest of the course leans on.
3. **[Time alignment](time-alignment.md)**: making every clock and timestamp on a single robot agree, the foundation that sensor fusion, state estimation, and control loops silently depend on.

### Returning semesters: pick any three


!!! note "Still in development, available Spring 2027"

    These electives are still being written. They'll be ready for returning students in Spring 2027; the required first-semester assignments above are available now.

4. **[Behavior architectures & autonomy](behavior-architectures.md)**: composing behavior with state machines, behavior trees, and planners.
5. **[Hardware basics](hardware-basics.md)**: sensors (IMUs, GPS, lidar, radar, cameras, encoders), motors (DC, BLDC, stepper, servo), buses (I2C, SPI, CAN, Ethernet), compute (MCUs vs. SBCs), and power (batteries, regulation), covering what each does, at what rate, and how each one fools you.
6. Multi-threading & concurrency: when concurrency actually helps, and how to dodge the classic pitfalls.
7. Frames & transforms: coordinate frames, rotations, and geodesy — converting between local and global frames, body and world, and LLA to ENU so every module agrees on where things are.
8. State estimation & SLAM: fusing noisy sensors into a confident estimate of pose and map.
9. Control systems: closing the loop between desired and actual (PID, LQR, MPC).
10. Path & motion planning: generating feasible trajectories through space and time.
12. Learning-based methods: when to reach for RL or imitation learning, and when not to.
13. Perception & computer vision: turning raw camera and lidar data into structured understanding. Listed last because modern pretrained vision models have made most of this nearly trivial.

VIP is typically a three-semester commitment. The required first-semester set plus two rounds of electives gets you through most of the list.

## 2. Contributions to a subteam

**Platform.** The [pidgin](pidgin.md) wire contract and the [Tower](tower.md) operator surface above it. Core platform work is mostly solved at this point. If you want to contribute to the server or UI, let me know and I'll find you something, but most of what's left to build now lives in the other two tracks.

**LLM.** Two modes: helping operators plan missions before launch, and grounding commands against what's live in the field. Most of the work is eval infrastructure: prompt pipelines, test suites, eventually fine-tuning on real sessions. Good fit if you care about making LLMs reliable in high-stakes settings.

**Autonomy.** Pick your own application and build a complete, vertically-integrated autonomy stack behind it. Any vehicle, any language, any problem area (search & rescue, agriculture, logistics, construction, environmental monitoring, etc). It has to talk to Tower over [pidgin](pidgin.md) and prove itself in a high-fidelity [SIL](progressive-testing.md) simulation, not a scripted telemetry feed standing in for a vehicle.

## Course logistics

**Weekly sync: Wednesdays at 5 PM, in person.** We meet every week in Klaus. Attendance is the default expectation, but I'm flexible: if you need to miss for a test, illness, or something else real, just let me know ahead of time. This is the main place to get unstuck on assignments and get feedback on your subteam's work.

**Send me your GitHub username at the start of the semester.** That's how your assignment repos get matched to your grade. There's no other submission step.