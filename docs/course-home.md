---
icon: lucide/book-open
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos** — robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student at Georgia Tech researching hybrid autonomy behavior architectures.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/) course at Georgia Tech, so — like all VIP courses — it's graded pass/fail. There are two requirements, and both are built to mirror how you'll actually work as a robotics engineer: one tests that you can solve scoped technical problems, and the other tests that you can ship real code into a real codebase.

## 1. Three CodeGrade assignments

Complete three assignments on CodeGrade over the semester. These aren't synthetic homework — I wrote each one from problems I've actually encountered: some drawn from technical interviews with hard-tech robotics companies like SpaceX, others from real issues I'm working through as a robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/). The format mirrors a take-home technical interview — a scoped problem, tests you need to pass, and automated grading — because that's where a lot of you will see problems like these next. **Attempts are unlimited** — the goal is to learn the material, not to one-shot it under pressure. If you're stuck, bring it to the weekly sync (see below).

Assignments span real robotics problems — core sub-specialties and the software skills that support them — applied, not academic. Two are required; pick one more to match where you want your robotics career to go.

**Required (do both):**

1. C++ CLI tooling: CMake fundamentals and the workflow to spin up a useful utility from scratch — a staple technical-interview exercise.
2. Simulation & sim-to-real: walking the SIL → HIL → hardware test progression, mocking sensors, subsystems, and hardware at each layer.

**Electives (pick 1):** *listed in natural learning order — jump around to whatever matches your interests.*

3. Multi-threading & concurrency: when concurrency actually helps, and how to dodge the classic pitfalls.
4. Robot math: the kinematics, dynamics, and transformations that underpin everything else.
5. State estimation & SLAM: fusing noisy sensors into a confident estimate of pose and map.
6. Control systems: closing the loop between desired and actual — PID, LQR, MPC.
7. Path & motion planning: generating feasible trajectories through space and time.
8. Behavior architectures & autonomy: composing behavior with state machines, behavior trees, and planners.
9. Learning-based methods: when to reach for RL or imitation learning — and when not to.
10. Perception & computer vision: turning raw camera and lidar data into structured understanding. Listed last because modern pretrained vision models have made most of this nearly trivial.


If you're aiming at motion planning, weight your electives there; if controls is your thing, do the controls-heavy ones. Goal is that your five feel cohesive for your trajectory, not scattershot.

## 2. One substantive merge into a project repo

Land one pull request into the `main` branch of one of the active course repositories:

- **[OpenC2](https://github.com/EthanMBoos/OpenC2)** — operator UI (Electron + React)
- **[OpenC2-Field](https://github.com/EthanMBoos/OpenC2-Field)** — field-side operator tooling
- **[openc2-gateway](https://github.com/EthanMBoos/openc2-gateway)** — Go gateway and envelope protocol
- **[maf_aerial](https://github.com/EthanMBoos/maf_aerial)** — aerial MAF implementation (C++, PX4 / MAVLink)

"Substantive" means something that required you to understand a subsystem — not a button swap or a typo fix. A list of candidate issues and features will be posted at the start of the semester; or you can propose your own idea and get it scoped before you start.

!!! tip "Start the PR early"

    The merge requirement is where most of the real learning happens, and it's also where students most often underestimate scope. Pick your issue in the first few weeks so review cycles don't stack up at the end of the term.

## Course logistics

**Weekly sync — Wednesdays at 5 PM, in person.** We meet every week in Klaus. Attendance is the default expectation, but I'm flexible: if you need to miss for a test, illness, or something else real, just let me know ahead of time. This is the main place to get unstuck on assignments, talk through PR scope, and generally get feedback on your work.

**AI tools are fair game.** Copilot, Claude, Cursor — use whatever makes you productive. That's how the industry actually works, and pretending otherwise doesn't prepare you for it. The rule is simple: **you are accountable for every line of code you commit or submit**. If I see unexplained complexity or a block of code that doesn't feel like yours, I'll ask you to walk me through it. If you can't explain what it does and why, I'll ask you to rewrite it and submit a written explanation of the new code.

**Get what you put in.** This course is deliberately applied. The point isn't to hand you a grade — it's to leave you with real interview-ready skills and a grounded picture of what the robotics industry is actually like day-to-day. Put the hours in and the goal is that by the end of the term you have code you're proud to point to — in a PR, on a resume, in an interview.
