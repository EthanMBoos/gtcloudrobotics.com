---
icon: lucide/layers
hide:
- toc
---

# Modular Autonomy Framework

Autonomous robots are increasingly commanded by systems that are hard to reason about — learned policies, whole-layer planners, AI nodes in behavior trees. The field answer for "is this safe to deploy" is simulation evaluation plus hope. MAF's answer is a typed, auditable authority boundary that every command must cross, regardless of what produced it.

**MAF** is a C++ mission execution runtime built around that boundary. A runtime monitor decides what commands are allowed through. A single-writer adapter is the only module permitted to write to the controller. Every decision is logged with enough context to reconstruct what happened and why — from logs alone, without operator memory.

The design is deterministic-first. MAF runs hand-coded behaviors reliably before learned components are introduced. When AI nodes are added, they slot in above the same boundary, satisfying the same interface. Nothing below the boundary changes.

```text
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

The boundary doesn't depend on what sits above it. A hand-coded navigate node and a learned policy satisfy the same interface. The monitor, adapter, and session log stay the same regardless.

## The Authority Boundary

The seam that matters runs between high-level autonomy and the trusted low-level controller. Two MAF-owned components enforce it:

**Runtime monitor** — sees every command before the adapter. Passes it through, substitutes a fallback, or triggers a halt based on structural invariants. Three invariant classes cover most of what's catchable at the command interface:

- **Per-sample bounds** — NaN/Inf, out-of-range values, stale sensor timestamps
- **Rate-of-change limits** — per-step deltas exceeding what the platform can physically execute
- **Temporal-window invariants** — individually valid commands that are collectively dangerous: oscillatory heading patterns, sustained max-rate commands past geofences, jerk exceeding mechanical tolerance

**Single-writer adapter** — the only module that links against the controller transport. Bypass is architecturally impossible, not merely prohibited. A command either passes the monitor and reaches the adapter, or it doesn't reach the controller at all.

Every monitor decision records the full active invariant set alongside the outcome. The key post-mortem question — did no applicable invariant exist for this failure, or did one exist and the monitor miss it — is always answerable from the log.

## Mission Execution

A mission is a sequence of tasks. Each task has a goal, a behavior node that executes it, and transition rules for what happens on success or failure. The mission executor is the state machine — it tracks which task is active, advances on completion, and handles failure transitions. The behavior node is the current executor: it ticks at 20 Hz and returns `Success`, `Failure`, or `Running`.

```text
Operator / Tower
  └── Mission (task list + transitions)
        └── MissionExecutor  ← state machine
              └── Active BTNode  ← current behavior, ticked 20x/sec
                    └── CommandStream → Monitor → Adapter → Controller
```

Every task can specify a primary behavior and a fallback. When the behavioral monitor flags a problem, the executor swaps to the fallback — the task goal stays the same, the behavior executing it changes. The monitor below sees no difference.

### Behavior nodes

Every behavior node — hand-coded or learned — satisfies the same contract:

```cpp
class BTNode {
public:
    virtual NodeStatus tick(const GoalContext& goal,
                            const WorldState&  world,
                            CommandStream&     out_cmd) = 0;
};
```

`GoalContext` carries mission-level intent (target waypoint, mode, mission ID). `WorldState` carries current vehicle state from the ArduPilot EKF. The contract is symmetric — substituting a learned node for a hand-coded one changes nothing below the boundary.

### User roles

Three roles interact with MAF at different levels:

| Role | What they touch |
|---|---|
| **System integrator** | Which behaviors exist, monitor limits, mode-to-behavior mappings |
| **Mission planner** | Task sequences, waypoints, mode labels, failure handling |
| **Field operator** | Start / pause / abort; reads plain-language status |

Operators pick intent. The system resolves implementation. A mission planner specifies `mode: careful` — they never see which behavior node that maps to.

## Sensor Integration

Navigation state comes from ArduPilot's EKF3, which fuses GPS, IMU, barometer, and compass on the controller. MAF's telemetry thread receives the already-fused output over MAVLink (`GLOBAL_POSITION_INT`) and writes it into `WorldState`. There is no separate navigation filter running in MAF.

Sensors ArduPilot doesn't see — lidar, camera, external perception — write into `WorldState` through their own threads. MAF owns that processing. This is the only domain where MAF runs any fusion logic of its own.

Every behavior node checks the timestamp on sensor data before acting on it. If a pose is older than the node's configured maximum, it returns `Failure` rather than navigating on stale data. The monitor's staleness check is the last line of defense, not the first.

## What the Monitor Can't Catch

A policy producing physically valid, sequentially reasonable commands that execute the wrong plan is invisible to the architectural monitor by construction. That failure class hands to a **behavioral monitor** running at the policy-semantics layer — temporal consistency over action distributions, VLM task-progress detection, out-of-distribution scoring on policy outputs. It doesn't gate commands; it raises a signal on a slower clock.

```text
                    policy command stream
                             │
           ┌─────────────────┼─────────────────┐
           ▼                                   ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Architectural       │         │  Behavioral          │
│  monitor (MAF)       │         │  monitor (Phase 3)   │
│                      │         │                      │
│  "is this command    │         │  "is this behavior   │
│   structurally       │         │   still doing        │
│   allowed"           │         │   the task"          │
└──────────┬───────────┘         └──────────────────────┘
           │ approved only
           ▼
    adapter / controller
```

The partition between layers is a function of the behavior's command distribution, not a fixed property of the monitors. For any given behavior, four catch fractions partition the failure space: architectural-only, behavioral-only, both, neither. Measuring those fractions across behavior types — hand-coded, conservative learned, aggressive learned — is the core research question this prototype is built to answer.

## Current State

I'm actively iterating on this design solo, so it's not yet open for student contributions — once the authority boundary contract is solid I'll bring people in on it.

Initial target: ArduPilot Rover SITL. Single process, no hardware required to run the experiment. A Jetson Orin + physical rover validates latency and real-world dynamics but doesn't change the research question.

**Phase 1 — Monitor contract in SITL** *(in progress)*

Core authority boundary running end-to-end in simulation with a hand-coded behavior node. Monitor enforces per-sample bounds, rate-of-change limits, and staleness. Session log reconstructs the full decision sequence.

**Phase 2 — Learned node injection**

Replace the hand-coded navigate node with a learned ONNX node above the boundary. Run the same monitor unchanged. Inject distribution-shifted inputs and measure catch fractions.

**Phase 3 — Behavioral monitor layer**

Add a behavioral monitor above the architectural boundary. Measure the four-way failure partition across behavior types.

## Where MAF Sits

MAF is the within-platform half of the composition story — the authority boundary on each vehicle. The cross-platform half is [Tower](tower.md), which composes vehicles into a fleet. The two boundaries are independent: MAF without Tower, or Tower without MAF, are both valid configurations.

!!! tip "Source and design notes"

    [MAF](https://github.com/EthanMBoos/MAF) — architecture, plan, and mission design docs in `docs/`.
