---
icon: lucide/layers
hide:
- toc
---

# Modular Autonomy Framework

**MAF** is a C++ mission and integration runtime built around ArduPilot. ArduPilot owns low-level vehicle control, state estimation, and failsafes; the MAF runtime owns mission sequencing, telemetry normalization, and the external command boundary. The durable contribution is a small set of MAF-owned contracts at the autopilot boundary, kept narrow and explicit so they stay stable as vehicles, transports, and autonomy components change.

The premise is that the load-bearing piece of fielding modern, learned robot autonomy isn't verifying the policy — it's specifying and enforcing the *authority boundary* between the policy and the certified layer below. MAF is the runtime that makes that boundary load-bearing: a runtime monitor enforces what crosses it, a single-writer adapter enforces who writes the autopilot, and a crash-isolated recorder captures enough state that when something goes wrong, fault class is recoverable from the artifacts alone.

```text
┌──────────────┐   MAVLink    ┌──────────────┐   Protobuf    ┌──────────────┐
│   Autopilot  │ ◀──────────▶ │     MAF      │ ◀───────────▶ │ tower-server │
│ (ArduPilot)  │              │(C++/Zenoh/BT)│   extension   │     (Go)     │
└──────────────┘              └──────────────┘               └──────────────┘
```

!!! note "Hardware target"

    The initial demonstration runs entirely in ArduPilot Rover SITL with Gazebo. Hardware deployment is still being scoped — the current candidate is a Clearpath Husky running ArduPilot Rover firmware.

## The Authority Boundary

Inside a single vehicle, the contract that matters runs between high-level autonomy — which can be anything from a hand-coded behavior tree to a single learned BT node to a whole-layer learned policy — and the certified low-level autopilot. Every command flowing across that seam passes through two MAF-owned components: a runtime monitor that decides whether the command is allowed, and an adapter that is the only module in the system permitted to write autopilot-facing commands.

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
        │  • single writer to ArduPilot               │
        └────────────────────┬────────────────────────┘
                             │ MAVLink
                             ▼
        ┌─────────────────────────────────────────────┐
        │  ArduPilot            (CERTIFIED)           │
        │  • low-level control, estimation, failsafes │
        └─────────────────────────────────────────────┘
```

The contract is **scale-invariant**. Whether the component above is 10M parameters or 10B, hand-coded or learned, the enforcement substrate, recording schema, and operational properties stay the same. That's the property MAF is built to preserve — the certifiable surface shrinks to the monitor and the adapter, and everything above is untrusted by default.

## Three Levels of Contracts

Contracts live at three levels, each subordinate to the one above:

- **Authority-boundary contract** *(primary)*. What crosses between high-level autonomy and ArduPilot, what cannot, and what invariants hold regardless of what produces commands above.
- **Monitor contract.** What gets checked at the boundary, what triggers intervention, what fallback behavior runs when an invariant is violated.
- **BT-node contract** *(module-level)*. Goal-context input, command-stream output, termination/timeout/fallback/replay semantics. Symmetric — hand-coded and learned ONNX implementations satisfy it identically — so individual nodes can be substituted, whole layers can be swapped, or the entire behavior tree can be replaced with a monolithic policy without disturbing the boundary above it.

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

Keeping the core in plain C++ rather than ROS nodes means the live middleware graph never becomes the application model. ROS can still wrap sensor drivers, perception packages, or visualization at the edges, but it adapts the contract instead of defining it.

## The Runtime Monitor

The monitor is the enforcement point. It sees every command before it reaches the adapter and either passes it through, replaces it with a fallback, or triggers a halt. Three classes of invariant cover most of what's catchable at the command interface:

- **Per-sample bounds.** NaN/Inf, out-of-range values, stale timestamps, output magnitudes outside the vehicle's safe envelope. Catches buggy policies that produce malformed commands.
- **Rate-of-change limits.** Per-step deltas exceeding what the platform can physically execute. Catches discontinuous output and sample-to-sample jumps from numerical instability.
- **Temporal-window invariants.** Sequences of individually in-bounds commands that are collectively dangerous: oscillatory heading patterns producing traction loss, sustained max-rate commands producing displacement past geofences, jerk patterns exceeding mechanical tolerance. Catches distribution-shifted policies producing well-formed but contextually wrong commands.

What the monitor *cannot* catch is also a structural property of the architecture rather than a limitation to be fixed: a policy producing physically valid, sequentially reasonable commands that execute the wrong plan — a hallucinated-plan failure — looks the same on the wire as a correct one. The authority boundary still provides crash isolation, complete recording, and fallback on downstream symptoms (geofence violation, autopilot intervention), and that failure class is where architectural fault isolation hands off to ML-interpretability layers above.

## Process Layout and Crash Isolation

MAF ships as two processes per vehicle. The mission runtime and adapter live in `maf_rover`; recording lives in a separate `maf_recorder` process. Crash isolation is structural — a learned-policy segfault in `maf_rover` cannot take the recorder down with it, and the recording schema is flushed on crash for post-hoc fault attribution.

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

The single-writer property is structural rather than policy-enforced: only `maf_ardupilot_adapter` links against the autopilot transport, so bypass is architecturally impossible rather than merely prohibited. Bypass attempts surface at link time, not at runtime.

Zenoh is the current default transport between modules where the in-process boundary doesn't reach (perception edges, ROS bridges, distributed sensors). Transport is an adapter — the contract boundary stays stable across transport substitutions.

## Hardened ONNX Admission

Learned components are untrusted. An ONNX artifact goes through a hardened admission step before integration, treating the model file as an external binary payload rather than a trusted dependency:

- **Schema validation.** Input shape and dtype, output shape and dtype, against the contract the monitor expects. Mismatches fail admission.
- **Output-range verification.** Static check that the policy's declared output range is compatible with the monitor's invariants — there's no point admitting a model whose declared output range exceeds bounds the monitor will reject every step.
- **Latency bounding.** Dry-run inference against the control-loop deadline. Boundary cases — artifacts that pass dry-run but miss deadlines under load — are characterized rather than assumed away.
- **Hash verification.** Integrity, not safety. Confirms the artifact hasn't been tampered with in transit.
- **Provenance record with domain-mismatch detection.** Pre-training domain tags, fine-tuning stages and data sources, simulator identity (engine + version, or world-model checkpoint identity for neural simulators), and dataset versions. Pre-training and fine-tuning tags are kept separate, since when pre-training is 99.9% egocentric video and fine-tuning is 0.1% teleop, generalization is governed by the pre-training distribution. Mismatch between pre-training tags and the deployment context's declared domain is surfaced at admission as a flag — not automatic rejection, but a refusal to deploy silently.

Admission is about **structural compatibility**, not behavioral safety. It doesn't claim the policy is correct; it claims the policy meets the structural preconditions of the boundary it's about to cross.

## Recording for Fault Attribution

When the vehicle fails, the question that matters is which component failed. Recording is what makes that answerable from artifacts rather than from operator memory or live debugging. The recorder captures the goal-context input flowing into the autonomy layer, the command-stream output flowing back out, the monitor decisions with the specific invariant evaluated and the full active invariant set, and the post-monitor adapter commands. With those four streams, faults attribute into one of four classes:

- **(A) Input fault.** Malformed, stale, or out-of-spec state data driving the policy. Sub-case: in-spec but from a domain the policy was not trained on.
- **(B) Output fault.** The policy emitted NaN, Inf, out-of-bounds, or frozen output.
- **(C) Monitor fault.** The monitor passed a command it shouldn't have. Disambiguated into C1 (the invariant set didn't cover this case) and C2 (the invariant existed and the monitor failed to enforce it) by checking the recorded active invariant set against the recorded decision.
- **(D) Autopilot-layer fault.** The certified controller misbehaved on a command the rest of the stack handled correctly.

Recordings carry platform identity and pidgin session context, so the same artifacts support cross-platform causal-event-ordering reconstruction at fleet scale rather than only single-vehicle replay.

## Where MAF Sits in the Stack

MAF is the **within-platform** half of our composition story — the authority boundary on each vehicle. The **cross-platform** half is [Tower](tower.md), which composes vehicles into a fleet through the [pidgin](pidgin.md) protocol seam. Vehicles plug into Tower by publishing a pidgin extension payload at one end of the runtime; MAF enforces the autopilot-facing contract at the other. The two boundaries are independent: you can adopt MAF without Tower, or Tower without MAF.

The initial demo target is a ground rover on ArduPilot Rover SITL with Gazebo, preserving the same authority split intended for later aerial vehicles.

!!! tip "Dive deeper"

    Design notes will be linked in a `maf_rover` repository soon.
