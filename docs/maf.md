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

    The initial demonstration runs entirely in ArduPilot Rover SITL with Gazebo. The hardware target pairs a ground robot running ArduPilot Rover firmware with an Nvidia Jetson Orin hosting the autonomy and inference stack, demonstrated SITL-first and then hardware-in-the-loop on the Orin to validate latency, crash isolation, and recording flush under conditions that don't resolve in software.

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

What the monitor *can't* catch is also baked into the architecture: a policy producing physically valid, sequentially reasonable commands that execute the wrong plan — a hallucinated-plan failure — looks the same on the wire as a correct one. The boundary still gives you crash isolation, complete recording, and fallback on downstream symptoms (geofence violation, controller intervention), but the failure class itself hands off to the layer above.

That layer is a **behavioral monitor** running at the policy-semantics layer: temporal consistency over action distributions (Sentinel-style), VLM-based judgments about whether the task is making progress, or out-of-distribution scoring on the policy's outputs. It doesn't gate commands; it raises a signal on a slower clock when the policy is no longer behaving like itself.

```text
                            policy command stream
                                     │
                   ┌─────────────────┼─────────────────┐
                   ▼                                   ▼
   ┌──────────────────────────────┐   ┌──────────────────────────────┐
   │  Architectural-boundary      │   │  Behavioral monitor          │
   │  monitor  (MAF)              │   │                              │
   │                              │   │  • temporal action           │
   │  • per-sample bounds         │   │    consistency (Sentinel)    │
   │  • rate-of-change limits     │   │  • VLM task-progress         │
   │  • temporal-window           │   │    detection                 │
   │    invariants                │   │  • out-of-distribution       │
   │                              │   │    scoring on outputs        │
   │  "is this command            │   │  "is this policy still       │
   │   structurally allowed"      │   │   doing the task"            │
   └──────────────┬───────────────┘   └──────────────────────────────┘
                  │ approved commands only
                  ▼
            adapter / controller
```

What each layer catches depends on what the policy emits. A conservative policy with strong reward shaping produces smooth, low-variance commands well inside the structural bounds — the architectural monitor rarely trips, and almost every catchable failure has to come from the behavioral layer. An aggressive policy trained with a time-optimal objective produces boundary-hugging, high-variance commands — the architectural monitor catches plenty, but the *kinds* of failures it catches and misses shift.

The partition between the two layers is a function of the policy's command distribution, not a fixed property of the monitors. Treating it as fixed — "the architectural layer handles X, the behavioral layer handles Y" — is the mistake. For any given policy the four catch fractions (architectural-only, behavioral-only, both, neither) literally partition the failure space, and the shape of that partition moves as the command distribution does.

The most important of those four is the **uncatchable residual** — failures neither layer can see. A policy producing physically valid, sequentially reasonable, task-coherent commands that execute the *wrong plan* is invisible to both layers by construction: the architectural monitor sees in-bounds commands; the behavioral monitor sees consistent action sequences and apparent task progress. This is the explicit boundary of runtime monitoring as a category. Closing it requires a layer above runtime monitoring — formal verification of plan structure, interpretability of policy internals, or constrained policy training. Runtime monitoring's job is to bound what it can bound and to make the residual auditable from the recordings.

Honest framing: this is robotics-policy behavioral monitoring at the command interface. It is not LLM safety, not RLHF supervision, not interpretability of policy internals. The category boundary stays narrow on purpose.

## Fault Attribution

The point of recording the full active invariant set with every command isn't bookkeeping — it's making fault attribution decidable from disk rather than from operator memory. The recorded streams (goal-context input, command-stream output, monitor decisions, post-monitor adapter commands) partition causally into input, output, monitor, and controller-layer faults. The interesting case is the monitor's own, which usually requires a postmortem judgment call: did no applicable invariant exist for this case, or did one exist and the monitor fail to enforce it? With the active invariant set recorded alongside the decision, that question collapses to a check against artifacts the recorder already wrote down.

Recordings also carry platform identity and pidgin session context, so the same artifacts reconstruct causal-event ordering across vehicles at fleet scale, not just single-vehicle replay. On hardware, frame-level capture of goal context, commands, monitor decisions with the active invariant set, post-monitor adapter commands, inference latency per artifact and power mode, and provenance tags lets the same recording double as an **observability surface for deployed learned components**, not only a fault-attribution artifact — one object, multiple uses.

## Hardened ONNX Admission

Learned components are untrusted, and the admission step treats an ONNX artifact like an external binary payload rather than a trusted dependency. Structural checks at admission cover what the runtime monitor can't see in advance: input and output schemas against the contract, declared output range against the monitor's invariants, dry-run latency against the control-loop deadline, and a cryptographic hash for integrity. None of that claims the policy is correct; it claims the policy meets the structural preconditions of the boundary it's about to cross.

The methodologically novel piece is the provenance record, and specifically the separation of pre-training tags from fine-tuning tags. When pre-training is 99.9% egocentric video and fine-tuning is 0.1% teleop, generalization is governed by the pre-training distribution — collapsing those into a single "training domain" field silently hides the dominant statistical regime. Provenance also captures simulator identity, including world-model checkpoint identity for neural simulators whose failure modes are entangled with the policy's. Mismatch between pre-training tags and the deployment context's declared domain surfaces at admission as a flag rather than an automatic rejection: a refusal to deploy *silently*, while leaving the call to whoever has context the admission protocol doesn't.

On hardware, the admission protocol gains a quantization-aware path: artifacts compile through **TensorRT** in INT8 or FP8 form, the dry-run repeats against the quantized engine, and latency is reported in real-time-systems terms — **worst-case execution time** and **deadline-miss rate under load** rather than averages — across multiple Jetson Orin power modes (15W, 30W, MAXN). An artifact that passes admission in FP32 but fails quantized output-range verification under thermal throttling doesn't get to deploy quantized, and that decision is recorded alongside the artifact's provenance.

## Where MAF Sits in the Stack

MAF is the **within-platform** half of our composition story — the authority boundary on each vehicle. The **cross-platform** half is [Tower](tower.md), which composes vehicles into a fleet through the [pidgin](pidgin.md) protocol seam. Vehicles plug into Tower by publishing a pidgin extension payload at one end of the runtime; MAF enforces the controller-facing contract at the other. The two boundaries are independent: you can adopt MAF without Tower, or Tower without MAF.

The initial demo target is a ground rover on ArduPilot Rover SITL with Gazebo, preserving the same authority split intended for later aerial and drive-by-wire vehicles.

!!! tip "Dive deeper"

    Design notes will be linked in a `maf_rover` repository soon.
