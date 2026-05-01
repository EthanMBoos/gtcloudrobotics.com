---
icon: lucide/book-open
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos** — robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student at Georgia Tech researching hybrid autonomy behavior architectures.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/) course at Georgia Tech, so — like all VIP courses — it's graded pass/fail. There are two requirements, and both are built to mirror how you'll actually work as a robotics engineer: one tests that you can solve scoped technical problems, and the other tests that you can ship real code into a real codebase.

**Not a GT student?** The material is open. All assignment repos live in [github.com/gtcloudrobotics](https://github.com/gtcloudrobotics) — click **Use this template** on any of them and push commits; the autograder runs on every push via GitHub Actions, same as for enrolled students, and you can see pass/fail in the Actions tab. PRs into the project repos (section 2) are welcome from anyone too — open an issue on the target repo first to scope the work. Anything below about Classroom, the weekly sync, or semester pacing is enrolled-specific.

## 1. Three autograded assignments

Complete three assignments over the semester. These aren't synthetic homework — I wrote each one from problems I've actually encountered: some drawn from technical interviews with hard-tech robotics companies like SpaceX, others from real issues I'm working through as a robotics engineer at [Georgia Tech Research Institute](https://www.gtri.gatech.edu/). The format mirrors a take-home technical interview — a scoped problem, tests you need to pass, and automated grading — because that's where a lot of you will see problems like these next. **Attempts are unlimited** — the goal is to learn the material, not to one-shot it under pressure. If you're stuck, bring it to the weekly sync (see below).

Accept each assignment through the [GitHub Classroom](https://classroom.github.com/classrooms/250684703-gtcloudrobotics-classroom) link — this creates your personal repo under the [gtcloudrobotics](https://github.com/gtcloudrobotics) org. Each repo ships with a GitHub Actions workflow that runs the test suite on every push, and the results auto-report to the instructor dashboard as your grade. **There's no separate submission step; pushing commits is the submission.** Check the **Actions** tab on your repo to see pass/fail.

### First semester — all three required

1. **[C++ CLI tooling](cpp-cli-tooling.md)**: CMake fundamentals and the workflow to spin up a useful utility from scratch.
2. **[System design](system-design.md)**: the top-level view of a robotics stack — how sensors, controllers, planners, and autonomy modules fit together, and why each runs at a different rate (controller in the kHz range, perception at camera fps, planner slower still). The mental model the rest of the course leans on.
3. **[Progressive testing](progressive-testing.md)**: walking the SIL → HIL → hardware test progression, mocking sensors, subsystems, and hardware at each layer.

### Returning semesters — pick any three

*Listed in natural learning order; jump around to whatever matches your interests.*

!!! note "Still in development — available Spring 2027"

    These electives are still being written. They'll be ready for returning students in Spring 2027; the required first-semester assignments above are available now.

1. Multi-threading & concurrency: when concurrency actually helps, and how to dodge the classic pitfalls.
2. Robot math: the kinematics, dynamics, and transformations that underpin everything else.
3. State estimation & SLAM: fusing noisy sensors into a confident estimate of pose and map.
4. Control systems: closing the loop between desired and actual — PID, LQR, MPC.
5. Path & motion planning: generating feasible trajectories through space and time.
6. Behavior architectures & autonomy: composing behavior with state machines, behavior trees, and planners.
7. Learning-based methods: when to reach for RL or imitation learning — and when not to.
8. Perception & computer vision: turning raw camera and lidar data into structured understanding. Listed last because modern pretrained vision models have made most of this nearly trivial.

Pick assignments that match where you want your robotics career to go. VIP is typically a three-semester commitment, so between the required first-semester set and two rounds of electives, you'll end up covering nearly every option by the time you're done.

## 2. One substantive merge into a project repo

Land one pull request into the `main` branch of one of the active course repositories:

- **[Tower](https://github.com/EthanMBoos/Tower)** — operator UI (Electron + React)
- **[Tower-Field](https://github.com/EthanMBoos/Tower-Field)** — field-side operator tooling
- **[tower-server](https://github.com/EthanMBoos/tower-server)** — Go server and pidgin envelope protocol
- **[maf_aerial](https://github.com/EthanMBoos/maf_aerial)** — aerial MAF implementation (C++, PX4 / MAVLink)

"Substantive" means something that required you to understand a subsystem — not a button swap or a typo fix. A list of candidate issues and features will be posted at the start of the semester; or you can propose your own idea and get it scoped before you start.

!!! tip "Start the PR early"

    The merge requirement is where most of the real learning happens, and it's easy to underestimate the scope. Pick your issue in the first few weeks so review cycles don't stack up at the end of the term.

## Course logistics

**Weekly sync — Wednesdays at 5 PM, in person.** We meet every week in Klaus. Attendance is the default expectation, but I'm flexible: if you need to miss for a test, illness, or something else real, just let me know ahead of time. This is the main place to get unstuck on assignments, talk through PR scope, and generally get feedback on your work.

**AI tools are fair game.** Copilot, Claude, Cursor — use whatever makes you productive. That's how the industry actually works, and pretending otherwise doesn't prepare you for it. The rule is simple: ==you are accountable for every line of code you commit or submit==. If I see unexplained complexity or a block of code that doesn't feel like yours, I'll ask you to walk me through it. If you can't explain what it does and why, I'll ask you to rewrite it and submit a written explanation of the new code.

**Get what you put in.** This course is deliberately applied. The point isn't to hand you a grade — it's to leave you with real interview-ready skills and a grounded picture of what the robotics industry is actually like day-to-day. Put the hours in and the goal is that by the end of the term you have code you're proud to point to — in a PR, on a resume, in an interview.
