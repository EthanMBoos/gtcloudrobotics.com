---
icon: lucide/layers
hide:
- toc
---

# Modular Autonomy Framework

Learned policies are about to start writing commands directly to robots that can hurt people or destroy expensive things — VLAs, whole-layer learned controllers, world-model-conditioned planners. The working answer in the field for "is this safe to field" is sim evaluation plus hope. That's not enough. What makes a learned policy fieldable isn't verifying the policy itself; it's specifying and enforcing what's allowed to cross the seam between the policy and the trusted control layer below it.

**MAF** is a C++ mission and integration runtime built around that seam. A runtime monitor decides what commands cross it, a single-writer adapter is the only module in the system permitted to write to the controller, and a crash-isolated recorder captures enough state that fault class is recoverable from the artifacts alone. The certified surface stays small while the policy above it can scale arbitrarily.

The initial backend is ArduPilot over MAVLink. The adapter is pluggable: `maf_ardupilot_adapter` is the first of a planned family that will include drive-by-wire and other trusted-controller backends. The boundary, monitor, recorder, and admission machinery are the parts meant to outlast any particular backend.

```text
┌──────────────┐   MAVLink    ┌──────────────┐   Protobuf    ┌──────────────┐
│  Controller  │ ◀──────────▶ │     MAF      │ ◀───────────▶ │ tower-server │
│ (ArduPilot)  │              │(C++/Zenoh/BT)│   extension   │     (Go)     │
└──────────────┘              └──────────────┘               └──────────────┘
```

!!! note "Initial hardware target"

    The initial demonstration runs entirely in ArduPilot Rover SITL with Gazebo. Hardware target is a Clearpath Husky running ArduPilot Rover firmware — picked over Husky's native ROS interface to make the single-writer property structural instead of conventional, at the cost of giving up the platform's stock ROS stack. The tradeoff is discussed below.

## Why MAVLink, Not cmd_vel

The obvious adoption path for a ground-robot framework is to publish `geometry_msgs/Twist` on `/cmd_vel` and inherit the entire ROS-native ecosystem — Husky, Jackal, Warthog, AgileX, TurtleBot — for free. MAF doesn't, and the reason is the same reason the framework exists.

ROS topics are multi-writer by design. Any node on the graph can publish to `/cmd_vel`, and the base controller takes commands from whoever shouts loudest. You can't make ROS single-writer through architecture; you can only make it single-writer through convention. The whole point of MAF is that convention isn't enough for learned policies — the boundary has to actually hold. With a MAVLink backend, only `maf_ardupilot_adapter` links against the autopilot transport, so bypass is a link-time error rather than a runtime hope.

The layer below also matters. ArduPilot ships with geofence, RTL, EKF failure handling, and a decade of failsafe engineering. The base controller behind `cmd_vel` typically ships with none of that. A boundary is only as strong as what sits on the other side of it.

MAF gives up easy adoption to keep the property. A future `maf_ros_cmd_vel_adapter` may ship as a weaker-guarantees mode for community use, clearly documented as such — but the strong-boundary version is what the framework is built around.

## The Authority Boundary

Inside a single vehicle, the seam that matters runs between high-level autonomy — anything from a hand-coded behavior tree to a single learned BT node to a whole-layer learned policy — and the trusted low-level controller. Every command flowing across that seam passes through two MAF-owned components: a runtime monitor that decides whether the command is allowed, and an adapter that is the only module in the system permitted to write controller-facing commands.

```text
        ┌─────────────────────────────────────────────┐
        │  High-level autonomy   (UNTRUSTED)          │
        │  • Hand-coded behavior tree                 │
        │  • Single learned BT node                   │
        │  • Whole-layer learned policy / WAM         │
        └────────────────────┬────────────────────────┘
                             │ command stream
                             ▼
        ┌─────────────────────────────────────────────┐
        │  Runtime monitor       (TRUSTED)            │
        │  • per-sample bounds, staleness, NaN/Inf    │
        │  • rate-of-change limits                    │
        │  • temporal-window invariants               │
        └────────────────────┬────────────────────────┘
                             │ approved commands only
                             ▼
        ┌─────────────────────────────────────────────┐
        │  maf_ardupilot_adapter (TRUSTED)            │
        │  • single writer to controller              │
        └────────────────────┬────────────────────────┘
                             │ MAVLink
                             ▼
        ┌─────────────────────────────────────────────┐
        │  ArduPilot            (TRUSTED CONTROL)     │
        │  • low-level control, estimation, failsafes │
        └─────────────────────────────────────────────┘
```

The contract doesn't depend on what sits above it. Whether the policy is 10M parameters or 10B, hand-coded or learned, the monitor, adapter, recording schema, and admission step stay the same. What changes at scale is what's plausible to put above the boundary — a 10B-parameter VLA replaces what used to be an entire planning stack — not how the boundary is enforced. The trusted surface stays small while the policy above can scale arbitrarily, which is the whole point.

## Fault Attribution

When a vehicle fails, the recorder captures four streams: the goal-context input flowing into the autonomy layer, the command-stream output flowing back out, the monitor decisions with the specific invariant evaluated and the full active invariant set, and the post-monitor adapter commands. With those four, faults attribute into one of four classes from the artifacts alone:

- **(A) Input fault.** Malformed, stale, or out-of-spec state data driving the policy. Sub-case: in-spec but from a domain the policy wasn't trained on.
- **(B) Output fault.** The policy emitted NaN, Inf, out-of-bounds, or frozen output.
- **(C) Monitor fault.** The monitor passed a command it shouldn't have. Split into C1 (the invariant set didn't cover this case) and C2 (the invariant existed and the monitor failed to enforce it) by checking the recorded active invariant set against the recorded decision.
- **(D) Controller-layer fault.** The trusted controller misbehaved on a command the rest of the stack handled correctly.

Recordings carry platform identity and pidgin session context, so the same artifacts support cross-platform causal-event reconstruction at fleet scale, not just single-vehicle replay. The cmd_vel path can't match this: without single-writer enforcement and a fully recorded boundary, fault class isn't recoverable from artifacts, and the post-incident investigation turns into a debugging session against operator memory.

## Three Levels of Contracts

Contracts live at three levels, each subordinate to the one above:

- **Authority-boundary contract** *(primary)*. What crosses between high-level autonomy and the controller, what can't, and what invariants hold regardless of what produces commands above.
- **Monitor contract.** What gets checked at the boundary, what triggers intervention, what fallback behavior runs when an invariant is violated.
- **BT-node contract** *(module-level)*. Goal-context input, command-stream output, termination/timeout/fallback/replay semantics. Symmetric — hand-coded and learned ONNX implementations satisfy it identically — so individual nodes can be substituted, whole layers swapped, or the entire behavior tree replaced with a monolithic policy without disturbing the boundary above it.

```cpp
// Every BT node — hand-coded or a learned ONNX wrapper —
// satisfies the same contract, so substitution is mechanical.

class BTNode {
  // Input  : structured goal context from the parent.
  // Output : command stream toward the authority boundary.
  // Termination, timeout, fallback, and replay all defined.
  Status tick(const GoalContext& goal,
              CommandStream&    out_cmd,
              const ReplayState* replay = nullptr);
};
```

Keeping the core in plain C++ instead of ROS nodes means the live middleware graph never becomes the application model. ROS can still wrap sensor drivers, perception packages, or visualization at the edges, but it adapts the contract instead of defining it.

## The Runtime Monitor

The monitor is the enforcement point. It sees every command before it reaches the adapter and either passes it through, replaces it with a fallback, or triggers a halt. Three classes of invariant cover most of what's catchable at the command interface:

- **Per-sample bounds.** NaN/Inf, out-of-range values, stale timestamps, output magnitudes outside the vehicle's safe envelope. Catches buggy policies that emit malformed commands.
- **Rate-of-change limits.** Per-step deltas exceeding what the platform can physically execute. Catches discontinuous output and sample-to-sample jumps from numerical instability.
- **Temporal-window invariants.** Sequences of individually in-bounds commands that are collectively dangerous: oscillatory heading patterns producing traction loss, sustained max-rate commands producing displacement past geofences, jerk patterns exceeding mechanical tolerance. Catches distribution-shifted policies that emit well-formed but contextually wrong commands.

What the monitor *can't* catch is also baked into the architecture: a policy producing physically valid, sequentially reasonable commands that execute the wrong plan — a hallucinated-plan failure — looks the same on the wire as a correct one. The boundary still gives you crash isolation, complete recording, and fallback on downstream symptoms (geofence violation, controller intervention), but that failure class is where architectural fault isolation hands off to ML-interpretability layers above.

## Process Layout and Crash Isolation

MAF ships as two processes per vehicle. The mission runtime and adapter live in `maf_rover`; recording lives in a separate `maf_recorder` process. Crash isolation is structural — a learned-policy segfault in `maf_rover` can't take the recorder down with it, and the recording schema is flushed on crash for post-hoc fault attribution.

```text
┌────────────────────────────────────────────────────┐  ┌──────────────────────┐
│  maf_rover  (process 1)                            │  │  maf_recorder        │
│                                                    │  │  (process 2)         │
│  ┌─────────────┐     ┌─────────────┐               │  │                      │
│  │  Mission BT │ ──▶ │   Monitor   │ ──────────────┼──┼─▶  Recording sink    │
│  │  + nodes    │     │             │               │  │   • crash-flushed    │
│  └─────────────┘     └──────┬──────┘               │  │   • fault-class meta │
│                             │ approved only        │  │   • session ID       │
│                             ▼                      │  │                      │
│                      ┌─────────────┐               │  └──────────────────────┘
│                      │   Adapter   │               │
│                      │ (single     │               │
│                      │  writer)    │               │
│                      └──────┬──────┘               │
└─────────────────────────────┼──────────────────────┘
                              │ MAVLink
                              ▼
                         ArduPilot
```

Only `maf_ardupilot_adapter` links against the controller transport, so bypass is architecturally impossible rather than merely prohibited. Bypass attempts surface at link time, not at runtime.

Zenoh is the current default transport between modules where the in-process boundary doesn't reach — perception edges, ROS bridges, distributed sensors. Transport is an adapter; the contract boundary stays stable across transport substitutions.

## Hardened ONNX Admission

Learned components are untrusted. An ONNX artifact goes through a hardened admission step before integration, treating the model file as an external binary payload rather than a trusted dependency:

- **Schema validation.** Input shape and dtype, output shape and dtype, against the contract the monitor expects. Mismatches fail admission.
- **Output-range verification.** Static check that the policy's declared output range is compatible with the monitor's invariants — no point admitting a model whose declared output range exceeds bounds the monitor will reject every step.
- **Latency bounding.** Dry-run inference against the control-loop deadline. Boundary cases — artifacts that pass dry-run but miss deadlines under load — are characterized, not assumed away.
- **Hash verification.** Integrity, not safety. Confirms the artifact hasn't been tampered with in transit.
- **Provenance record with domain-mismatch detection.** Pre-training domain tags, fine-tuning stages and data sources, simulator identity (engine + version, or world-model checkpoint identity for neural simulators), and dataset versions. Pre-training and fine-tuning tags are kept separate, because when pre-training is 99.9% egocentric video and fine-tuning is 0.1% teleop, generalization is governed by the pre-training distribution. Mismatch between pre-training tags and the deployment context's declared domain is surfaced at admission as a flag — not automatic rejection, but a refusal to deploy silently.

Admission checks structural compatibility, not behavioral safety. It doesn't claim the policy is correct; it claims the policy meets the preconditions of the boundary it's about to cross.

## Where MAF Sits in the Stack

MAF is the **within-platform** half of our composition story — the authority boundary on each vehicle. The **cross-platform** half is [Tower](tower.md), which composes vehicles into a fleet through the [pidgin](pidgin.md) protocol seam. Vehicles plug into Tower by publishing a pidgin extension payload at one end of the runtime; MAF enforces the controller-facing contract at the other. The two boundaries are independent: you can adopt MAF without Tower, or Tower without MAF.

The initial demo target is a ground rover on ArduPilot Rover SITL with Gazebo, preserving the same authority split intended for later aerial and drive-by-wire vehicles.

!!! tip "Dive deeper"

    Design notes will be linked in a `maf_rover` repository soon.
