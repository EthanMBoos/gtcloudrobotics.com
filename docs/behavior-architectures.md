---
icon: lucide/git-branch
---

# Behavior Architectures & Autonomy

A human hands the robot a job (a mission): search this area, deliver to this room, inspect this line, pick that fruit. That's the mission layer, and it doesn't say how. Everything below it has to turn that one job into a sequence of behaviors, switch between them as conditions change, and decide what to do when one of them isn't working. That's the autonomy layer. Its job is deciding *which behavior should be running right now, and what to do when it should change.*

It's a different question from "what's the path from A to B" (a planner's job) and "how do I track this trajectory" (a controller's job). Given the mission's current task, should the robot be exploring, or has it seen enough to switch to tracking? If tracking fails, retry, fall back to exploring, or abort up to the mission layer?

---

## 1. Where This Layer Sits

```text
Mission        "search zone A, then return"             ~1 Hz
  │
Behavior        "right now: explore, or track,         ~5-20 Hz
  │              or return, and what if this fails"
  │
Planner         "the actual path/trajectory for        rate varies,
  │              whichever behavior is active"          often bursty
  │
Controller      "track that trajectory"                ~100Hz-1kHz
```

Mission logic hands the behavior layer a goal and doesn't care how it's achieved. The controller executes whatever trajectory it's handed and doesn't know why. The behavior layer is the only place that holds both: it knows the goal *and* it knows what's currently happening on the robot, and its entire job is deciding which lower-level machinery should be active and when to switch.

Two implementation patterns dominate: **state machines** and **behavior trees**. A third piece, **planners**, isn't a competing pattern; it's what a behavior calls when "what to do" requires search rather than a lookup. Each behavior typically owns its own specific planner: a coverage planner for `Explore`, a pursuit predictor for `Track`, a path planner for `ReturnHome`. The behavior layer doesn't compute paths itself; it decides when to call its planner and what to do if that planner fails.

---

## 2. State Machines: Explicit, Until They Aren't

A state machine names every mode the robot can be in and every transition between them:

```text
states:      Takeoff, Cruise, Search, Track, ReturnHome, Land
transitions: Takeoff → Cruise        (altitude reached)
             Cruise → Search         (at search zone)
             Search → Track          (target detected)
             Track → Search          (target lost > 5s)
             * → ReturnHome          (low battery, any state)
             ReturnHome → Land       (at home)
```

This is the right tool when the behavior repertoire is small, well-understood, and mostly sequential. A state machine like this is easy to draw and easy to explain to someone who's never seen the code. If you can enumerate every state and transition, you can test all of them, which is genuinely valuable when you need to be sure what the robot will and won't do.

The problem is the `* → ReturnHome` line. "Low battery" has to interrupt every state, which means either duplicating that transition into every state's logic, or building a second mechanism (a supervisor that watches all states) on top of the state machine you already have. Add a second cross-cutting concern (link loss, geofence breach, operator abort) and you're duplicating each one into every state again. The transition table that looked clean at six states gets unmanageable once a handful of concerns can fire from anywhere. That's state explosion: not the states growing, but the cross product of states and concerns.

Hierarchical state machines (states that contain sub-states) push this further out, but the tooling cost rises with it. At that point you're most of the way to reinventing a behavior tree by hand.

---

## 3. Behavior Trees: Reactivity Without a Transition Table

A behavior tree replaces "what state am I in" with "what does this tree decide right now, re-evaluated from the root every tick." Every node, leaf or composite, returns one of three statuses when ticked: `Success`, `Failure`, or `Running`.

Two composite types do most of the work:

```text
Fallback (?)                    Sequence (→)
├── Track target                ├── Reached search zone?
├── Explore search zone         ├── Target detected?
└── Hold position               └── Track target
tries each child in order,      runs children in order,
stops at the first Success      stops at the first Failure
```

A low-battery check no longer needs to be wired into every state; it's one fallback node wrapping the whole tree once:

```text
Fallback (?)
├── Battery low? → ReturnHome
└── [rest of the mission tree]
```

That's the actual win over a flat state machine: a new cross-cutting concern is a new node in one place, not a new line in every state's transition table. And there's no stored "current state" to fall out of sync with reality.

A tree doesn't eliminate state; it relocates it. The global mode variable is gone, but a leaf still keeps its waypoint index and retry count, a latching condition still remembers whether it tripped, and the library tracks which nodes are mid-run. Each piece of state lives inside the one node that needs it, and "what is the robot doing" isn't stored anywhere: it's whichever branch is winning the arbitration this tick.

The common way to lose all of this: writing a behavior tree that's secretly a nested if-else. If a leaf blocks until its sub-task finishes, most often by *waiting on its planner*, instead of returning `Running` and getting re-ticked, the tree can't react to anything while that leaf is stuck. A planner can take a long time relative to the tick rate, so a leaf should kick the planner off, return `Running`, and poll it on later ticks rather than waiting. A behavior tree only buys you reactivity if every node respects `Running` and returns control on every tick.

A second trap lives in the libraries you'll actually use. The tick-by-tick re-evaluation described above is what BehaviorTree.CPP calls the *reactive* composites (`ReactiveSequence`, `ReactiveFallback`). The plain `Sequence` and `Fallback` have memory: once a child returns `Running`, later ticks jump straight back to that child and skip everything before it.

```text
Sequence (→)                        ReactiveSequence (→)
├── Battery ok?                     ├── Battery ok?
└── [Explore leaf]                  └── [Explore leaf]

tick 1   battery ok → Explore       tick 1   battery ok → Explore
tick 2   resume Explore             tick 2   battery ok → Explore
  ...    (battery never               ...
         checked again)             tick n   battery LOW → halt Explore
```

Memory is sometimes what you want: in a fixed task order, a finished step shouldn't re-run just because the next one is slow. But any condition that has to stay live while something below it runs, which is every safety and priority check, needs a reactive composite above it.

Reactivity also has its own failure mode: oscillation. A condition re-checked every tick will flap when its input hovers near the threshold; battery at 29.9%, then 30.1%, and the robot bounces between returning home and resuming work. In a state machine the transition fires once and you're committed. In a reactive tree, staying committed is the condition's job, and the standard tools are hysteresis (trip the battery concern at 30%, don't release it until 90%) and cooldowns (after finishing an inspection, ignore that target for a while). When a reactive tree twitches between behaviors, the bug is almost always in a condition, not a composite.

One more thing leaves need: a way to share data. The tree doesn't pass values from one node to another through its structure, so behaviors read and write a shared store (often called a *blackboard*): perception writes the target's last-known position, and `Track` reads it. Keep it disciplined, with one writer per piece of data and a timestamp on anything that can go stale, so `Track` knows the difference between a fresh fix and a thirty-second-old ghost.

---

## 4. Composing All Three: A Worked Example

A search-and-track UAV mission, one tree:

```text
Sequence (→)
├── Fallback (?)
│   ├── Battery low? → [ReturnHome leaf]
│   └── Sequence (→)
│       ├── [Fly-to-zone leaf]          (planner: path to search zone)
│       └── Fallback (?)
│           ├── Sequence (→)
│           │   ├── Target detected?
│           │   └── [Track leaf]        (planner: pursuit trajectory)
│           ├── [Explore leaf]          (planner: coverage path)
│           └── [Hold leaf]             (no planner: hover in place)
└── [Land leaf]
```

Each leaf owns at most one planner call and reports `Success`/`Failure`/`Running` honestly. The tree never touches a waypoint or a trajectory directly; it only ever sees behavior-level outcomes. If `Explore` fails because the coverage planner can't find a feasible sweep, that surfaces as `Failure`, the fallback above it catches it, and the mission degrades to holding position instead of the robot silently running on a stale or partial plan. Swap `Track` for a learned pursuit policy later and nothing else in the tree has to change. This is the same lesson as [system design §2](system-design.md#2-interfaces-are-the-real-architecture): the leaf's interface is what makes it swappable, not its implementation.

Note that the `Battery low?` node here is the *soft* version: a graceful return while the robot is still flyable. A hard interlock (e-stop, motor over-temp) is different. It shouldn't live inside the tree at all, since it can't depend on the same tick loop that might be the thing that's wedged. Those belong in a small independent supervisor that can override the whole stack.

---

## 5. Building This For Your Own Project

Start with the smallest tool that fits. For a handful of behaviors with mostly sequential transitions, a flat state machine is a fine choice: the transition matrix fits in your head, you can test every edge, and you skip learning a tick loop and a library. Production autopilots like PX4 run their mode logic as an explicit state machine.

Behavior trees earn their setup cost when a project accumulates what §2 predicted: more behaviors, more cross-cutting concerns, more edge cases from the real world. That's their pedigree, too: they came out of game AI as a complexity-management tool, and Nav2 uses them because navigation with retries and recoveries otherwise becomes an FSM with dozens of states and hundreds of transitions.

When you do reach for a tree, the whole pattern is: a `Sequence` for your task order, a `Fallback` for whatever soft concern has to interrupt from anywhere (low battery, link loss, operator abort), and one leaf per behavior calling into that behavior's own planner. Give the root a sensible default at the bottom (hold, hover, stop) so the tree always has *something* safe to run, and keep hard safety in a separate supervisor outside the tree.

Whichever you pick, every behavior has to make the same things explicit: what it does when it's working, what happens when it fails, and what it cleans up if it's interrupted mid-run. A behavior with no defined fallback is a robot that keeps running but quietly stops doing the job it was given.
