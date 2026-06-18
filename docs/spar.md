---
icon: lucide/layers
hide:
- toc
---

# Sim-Portable Autonomy Runtime

**SPAR** is a C++ mission execution runtime whose central claim is invariance-by-construction across two substitution axes: swapping the source of an observation (simulation vs. hardware) and swapping the behavior that consumes it (hand-coded vs. learned policy) both leave the surrounding pipeline bit-identical. The mechanism is a single-reader deterministic snapshot: asynchronous transport is demoted to dumb stamp-and-push writers feeding per-source ring buffers, and a single reader builds one immutable, time-coherent `WorldState` per tick via a pure `latest_at_or_before(t)` lookup. Because the assembly is a pure function of buffer contents and reference time, scheduler jitter, callback ordering, and "newest-available smear" cannot leak into the observation. The nondeterminism is quarantined to the write side.

```text
        sensor sources (async, different rates/latencies)
                              │
                              ▼
┌─────────────────────────────────────────────┐
│  Observation assembler      (TRUSTED)       │
│  ring buffers · latest-as-of-t · staleness  │
└────────────────────┬────────────────────────┘
                     │ time-coherent WorldState (one per tick)
                     ▼
┌─────────────────────────────────────────────┐
│  Mission layer              (UNTRUSTED)     │
│  Hand-coded behaviors · learned nodes       │
└────────────────────┬────────────────────────┘
                     │ command stream
                     ▼
┌─────────────────────────────────────────────┐
│  Runtime monitor            (TRUSTED)       │
│  bounds · rate-of-change · staleness        │
└────────────────────┬────────────────────────┘
                     │ approved commands only
                     ▼
┌─────────────────────────────────────────────┐
│  Adapter → ArduPilot        (TRUSTED)       │
│  single writer to controller                │
└─────────────────────────────────────────────┘
```

The payoff is not that simulation equals reality. It is that the residual sim-to-real gap is cornered rather than closed: confined to one component (the sample streams themselves), which are injected through a single transport-degradation layer calibrated to delay/jitter/dropout distributions measured on the real hardware. The gap is localized and measurable instead of smeared across the stack. With the source isolated as the only free variable, SPAR can measure the four-way partition of the failure space across behavior types (hand-coded, conservative learned, aggressive learned), turning "is this policy safe to deploy" from simulation-plus-hope into a quantity you can actually report.

The runtime enforces this through two typed boundaries sandwiching an untrusted mission layer. Neither boundary depends on what sits between them. A runtime monitor decides what commands are allowed through. A single-writer adapter is the only module permitted to write to the controller. A companion seam on the input side, the observation assembler, guarantees that every behavior, learned or hand-coded, reads a single time-coherent view of the world. Every decision is logged with enough context to reconstruct what happened and why, from logs alone, without operator memory.

SPAR runs hand-coded behaviors reliably before learned components are introduced. When AI nodes are added, they slot in between the same two boundaries, satisfying the same interfaces. Nothing below the command boundary changes, and nothing above the observation boundary changes how the world is built.

## The Observation Assembler

This is the component that makes both substitution axes hold: the same assembler, the same `latest_at_or_before(t)` lookup, and the same staleness math run in simulation and on the rover. Only the source implementation changes. That is the entire point. A learned policy that trained on clean, synchronous observations will see something different at run time unless one component is responsible for making the two match.

The authority boundary governs what leaves the mission layer. The observation assembler governs what enters it. Where the monitor is the typed boundary on the command stream, the assembler is the typed boundary on the observation stream, and it exists for the same reason.

In a callback-driven runtime, sensor data arrives asynchronously (the LiDAR scan is 80 ms old, external perception 120 ms, the EKF pose 2 ms), and concatenating "the latest value from each source" produces an observation stitched from instants that never co-existed in the world. That temporal smear is the failure usually misattributed to "the sim-to-real gap." Removing it is the assembler's whole job.

**Sources are dumb writers.** Each sensor thread does one thing: stamp each sample with its capture time and push it into a per-source ring buffer a few samples deep. No processing, no triggering downstream work, no fusion at write time. The writers keep the buffers current and nothing else.

**One reader builds the observation.** Once per tick, before the active behavior node runs, the executor selects a reference time `t` (the tick time, or the capture stamp of the slowest critical source) and for each ring takes the most recent sample at or before `t` (`latest_at_or_before(t)`, not "newest available"). The result is a single immutable, time-coherent `WorldState` snapshot. Async in, synchronous out. The graph stays callback-driven; the policy only ever sees a clean, fixed-rate sequence of coherent observations, the loop it was trained against. The ring depth, rather than a single latest value, is what makes the as-of-`t` lookup possible.

**Staleness is part of the observation, not just a gate.** The snapshot carries, per source, how old that component was relative to `t`. For a learned node these staleness channels go *into* the input vector: a policy that knows its LiDAR is 90 ms old can behave differently from one that's been told the data is fresh, and hiding staleness is what makes a policy brittle when latency shifts. When a required source exceeds its staleness bound or is missing, the assembler emits an explicit degraded verdict, and that verdict deterministically routes to the fallback (see Mission Execution). This is the authoritative, first place staleness is computed; the node-level and monitor-level staleness checks become redundant defense, not the primary line.

**Capture time, not receipt time.** Samples are stamped with the sensor's own capture timestamp (the EKF/MAVLink stamp, or hardware timestamps where available), never the wall-clock time the callback happened to run. Receipt time already has executor and transport jitter baked in; stamping there just relaunders the noise the assembler exists to remove. This requires a disciplined common time base across sources.

**The assembler is a standalone library.** It depends only on a timestamped `Sample<T>`, the ring buffers, and the snapshot builder, with no SPAR, MAVLink, or ArduPilot types. SPAR wires it in; it does not own it. This is the one component that must survive a change of controller, transport, or runtime, so its portability is deliberate rather than incidental.

## The Authority Boundary

The seam that matters on the output side runs between high-level autonomy and the trusted low-level controller. Two SPAR-owned components enforce it:

**Runtime monitor.** Sees every command before the adapter. Passes it through, substitutes a fallback, or triggers a halt based on structural invariants. Three invariant classes cover most of what's catchable at the command interface:

- **Per-sample bounds:** NaN/Inf, out-of-range values, stale sensor timestamps
- **Rate-of-change limits:** per-step deltas exceeding what the platform can physically execute
- **Temporal-window invariants:** individually valid commands that are collectively dangerous, like oscillatory heading patterns, sustained max-rate commands past geofences, or jerk exceeding mechanical tolerance

**Single-writer adapter.** The only module that links against the controller transport. Bypass is architecturally impossible, not merely prohibited. A command either passes the monitor and reaches the adapter, or it doesn't reach the controller at all.

Every monitor decision records the full active invariant set alongside the outcome. The key post-mortem question is always answerable from the log: did no applicable invariant exist for this failure, or did one exist and the monitor miss it?

**Where the override authority actually lives.** ArduPilot is trusted for low-level control and failsafe, but it will faithfully execute a *valid-but-wrong* command. The protection that makes this a runtime-assurance (simplex) architecture, the ability to override a plausible-looking command from an untrusted policy, lives in SPAR's monitor and fallback on the mission computer, not in the controller. The controller is the actuator with reflexes; the monitor plus the trusted fallback is the simplex safety controller. Treating "a Pixhawk running ArduPilot" as equivalent to "runtime assurance over the policy" is the trap; it isn't.

**The controller contract.** The monitor's bounds and rate-of-change limits are not arbitrary numbers; they are derived from the envelope ArduPilot will actually accept and physically execute in the active mode (the GUIDED setpoint ranges and rates for the Rover frame). The monitor should never approve a command ArduPilot would accept but shouldn't act on; the simple kinematic clamp lives here.

One external behavior must be characterized by hand, because in this architecture it is the fallback of last resort and SPAR does not own it: what ArduPilot does when setpoints go stale or stop arriving. Hold last command, ramp to neutral, RTL, failsafe: the answer is version-, frame-, and parameter-dependent and must be measured on the exact configuration in use. If that behavior is known-safe, then "stop writing" becomes a legitimate, deliberate fallback that lets ArduPilot's own failsafe catch the vehicle. If it isn't safe on timeout, the mission-side fallback must guarantee safety without that backstop, and that has to be known before it's relied on.

## Mission Execution

A mission is a sequence of tasks. Each task has a goal, a behavior node that executes it, and transition rules for what happens on success or failure. The mission executor is the state machine; it tracks which task is active, advances on completion, and handles failure transitions. On each 20 Hz tick it first asks the assembler for the current `WorldState`, then ticks the active behavior node, which returns `Success`, `Failure`, or `Running`.

```text
Operator / Tower
  └── Mission (task list + transitions)
        └── MissionExecutor  ← state machine
              ├── Observation assembler  ← builds WorldState, once per tick
              └── Active BTNode  ← current behavior, ticked 20x/sec
                    └── CommandStream → Monitor → Adapter → Controller
```

Every task specifies a primary behavior and a fallback. The fallback is **not** merely another behavior node that might also misbehave; it is a hand-coded, verified, deliberately conservative controller (decelerate-and-hold, hold-last-safe-heading, or hand back to an ArduPilot mode such as RTL). It is the trusted controller in the runtime-assurance sense, and it can be invoked from three places: the behavioral monitor flags a semantic problem, the architectural monitor substitutes after rejecting a command, or the assembler emits a degraded/missing verdict. In every case the task goal is unchanged; only the behavior executing it changes, and the monitor below sees no difference. Because the safety argument rests on this fallback, it should be the simplest, most-reviewed code in the system.

### Behavior nodes

Every behavior node, hand-coded or learned, satisfies the same contract:

```cpp
class BTNode {
public:
    virtual NodeStatus tick(const GoalContext& goal,
                            const WorldState&  world,
                            CommandStream&     out_cmd) = 0;
};
```

`GoalContext` carries mission-level intent (target waypoint, mode, mission ID). `WorldState` carries the assembled, time-coherent snapshot for the current tick: fused vehicle state plus external perception, each component tagged with its staleness relative to the tick's reference time. The contract is symmetric: substituting a learned node for a hand-coded one changes nothing below the command boundary, and the upgraded `WorldState` reaches both kinds of node through the same unchanged signature.

### User roles

Three roles interact with SPAR at different levels:

| Role | What they touch |
|---|---|
| **System integrator** | Which behaviors exist, monitor limits, mode-to-behavior mappings, staleness bounds |
| **Mission planner** | Task sequences, waypoints, mode labels, failure handling |
| **Field operator** | Start / pause / abort; reads plain-language status |

Operators pick intent. The system resolves implementation. A mission planner specifies `mode: careful`; they never see which behavior node that maps to.

## Sensor Integration

Navigation state comes from ArduPilot's EKF3, which fuses GPS, IMU, barometer, and compass on the controller. SPAR's telemetry thread receives the already-fused output over MAVLink (`GLOBAL_POSITION_INT`) and writes it into the assembler as one source. There is no separate navigation filter running in SPAR. Sensors ArduPilot doesn't see (lidar, camera, external perception) write in as their own sources; this is the only domain where SPAR runs any fusion logic of its own, and even that happens before the write, leaving the assembler to do only time-alignment.

Every source, whether it originates in SITL or on hardware, feeds the assembler through one abstract sample-source interface. This is what makes the sim-to-real claim checkable rather than aspirational: the same assembler, the same `latest_at_or_before(t)` lookup, and the same staleness math run in simulation and on the rover; only the source implementation changes.

**Simulation must inject transport degradation.** This is the calibration that makes the gap localized rather than diffuse. Shipping the assembler without the degradation layer produces sim results that describe a world that doesn't exist. In SITL, samples arrive perfectly fresh and synchronous, a fantasy that does not survive contact with a real vehicle. A configurable degradation layer sits in front of each simulated source and injects per-stream delay, jitter, and dropout drawn from distributions measured on the real rover. Without it, the observation built in SITL is not the observation built on hardware, and any catch fraction measured in simulation describes a world that doesn't exist. For the Phase 2 experiment, distribution shift means *timing* shift (delay, jitter, dropout) as much as value shift.

Per-node staleness checks remain (a node returns `Failure` rather than acting on data older than its configured maximum), but they are now backstops behind the assembler's authoritative verdict, not the first line of defense.

!!! note "The assembler and the degradation layer are one unit"

    A clean assembler fed by undegraded SITL streams looks correct immediately, which is exactly the danger: it will make sim-to-real appear solved when only the easy half is. The assembler (Phase 1) and transport-degradation injection (Phase 2 gate) are a pair; shipping the former without the latter produces a Phase 2 catch-fraction result that looks great in simulation and falls apart on the rover.

## What the Monitor Can't Catch

A policy producing physically valid, sequentially reasonable commands that execute the wrong plan is invisible to the architectural monitor by construction. That failure class hands to a **behavioral monitor** running at the policy-semantics layer: temporal consistency over action distributions, VLM task-progress detection, out-of-distribution scoring on policy outputs. It doesn't gate commands; it raises a signal on a slower clock.

```text
                    policy command stream
                             │
           ┌─────────────────┼─────────────────┐
           ▼                                   ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Architectural       │         │  Behavioral          │
│  monitor (SPAR)      │         │  monitor (Phase 3)   │
│                      │         │                      │
│  "is this command    │         │  "is this behavior   │
│   structurally       │         │   still doing        │
│   allowed"           │         │   the task"          │
└──────────┬───────────┘         └──────────────────────┘
           │ approved only
           ▼
    adapter / controller
```

To keep the behavioral monitor a clean add-on rather than a later re-architecture, SPAR logs the assembled observation (with per-source staleness) alongside the command on every tick. The behavioral monitor consumes that observation/action history as a downstream reader on its slower clock and, when it flags a problem, drives the same executor fallback swap that already exists. The genuinely hard, still-unsolved part (the semantic "is it doing the right task" judgment) slots in above the boundary without touching it.

The partition between layers is a function of the behavior's command distribution, not a fixed property of the monitors. For any given behavior, four catch fractions partition the failure space: architectural-only, behavioral-only, both, neither. Measuring those fractions across behavior types (hand-coded, conservative learned, aggressive learned) is the core research question this prototype is built to answer.

## Current State

I'm actively iterating on this design solo, so it's not yet open for student contributions. Once the authority boundary contract is solid I'll bring people in on it.

Initial target: ArduPilot Rover SITL. Single process, no hardware required to run the experiment. A Jetson Orin + physical rover validates latency and real-world dynamics but doesn't change the research question.

**Phase 1: Monitor contract and observation assembler in SITL** *(in progress)*

Core authority boundary running end-to-end in simulation with a hand-coded behavior node. The observation assembler produces the time-coherent `WorldState` from per-source ring buffers, with per-component staleness carried in the snapshot. The monitor enforces per-sample bounds, rate-of-change limits, and staleness, with limits derived from ArduPilot's accepted command envelope. The trusted conservative fallback is defined and wired to monitor substitution and to the assembler's degraded verdict. ArduPilot's stale/lost-command behavior is characterized on the target SITL configuration. Session log reconstructs the full decision sequence, including the assembled observation per tick.

**Phase 2: Learned node injection**

Replace the hand-coded navigate node with a learned ONNX node above the boundary, reading the same `WorldState` and feeding the same monitor unchanged. The sim/real source abstraction and the transport-degradation layer must be in place first; distribution shift here includes timing (delay, jitter, dropout drawn from measured rover distributions) as well as value shift. Inject shifted inputs and measure catch fractions.

**Phase 3: Behavioral monitor layer**

Add a behavioral monitor above the architectural boundary, consuming the logged observation/action stream on a slower clock and driving the existing fallback swap. Measure the four-way failure partition across behavior types.

## Where SPAR Sits

SPAR is the within-platform half of the composition story: the authority boundary on each vehicle. The cross-platform half is [Tower](tower.md), which composes vehicles into a fleet. The two boundaries are independent: SPAR without Tower, or Tower without SPAR, are both valid configurations.

!!! tip "Source and design notes"

    [SPAR](https://github.com/EthanMBoos/SPAR): architecture, plan, and mission design docs in `docs/`.
