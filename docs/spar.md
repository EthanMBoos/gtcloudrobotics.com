---
icon: lucide/layers
hide:
- toc
---

# SPAR — Sim Portable Autonomy Runtime

!!! note "Work in progress"

    Actively building this out solo, not ready for student contributors yet. The runtime and its eval protocol are the active priority.

    Not yet structured for outside contributors, but the design is public and meant to be read.

**SPAR** is a C++ runtime. It enforces one thing: an unbypassable command authority
boundary. An untrusted mission layer proposes commands; a trusted runtime monitor vets
every one before it reaches the vehicle controller; a single-writer adapter is the only
path to the controller. The boundary holds **bit-identical** across two substitution axes:
observation source (simulation vs. hardware) and behavior (hand-coded vs. learned). The
policy is the only free variable. The monitor checks every command against the active controller's
accepted envelope, whatever produced it. Gating vehicle-control commands like this is a
different problem from the tabletop manipulation setting most of this work targets.

To stress the boundary's policy-invariance, behaviors are swapped through it from the most
predictable to the most adversarial: a hand-coded baseline, a conventional RL policy (SAC
via `KinematicBackend`), and foundation-model actors (Cosmos-based VLAs), the hardest free
variable. The RL baseline is built first to validate the pipeline and establish catch
fractions before VLA data collection begins. Cosmos is a stress test for the boundary,
nothing more.

## Research Questions

> **Can a fixed runtime monitor reliably catch dangerous commands regardless of what policy produces them and how does that guarantee hold up as the policy changes?**

> **When an operator delegates a behavior to a learned policy, what does the monitor catch that the operator can't anticipate?**

The four-way partition below is how the boundary is **evaluated**. Every catch is
attributed to a layer, so the post-mortem question is always answerable:

| Class | Caught by |
|---|---|
| Architectural-only | Runtime monitor (bounds, rate-of-change, temporal-window) |
| Behavioral-only | Behavioral monitor: any success-calibrated, conformal-thresholded detector (slot) |
| Both | Both layers |
| Neither | The uncatchable residual: explicit boundary of what monitoring can do |

The **boundary is the contribution; the partition is how it's validated.** The catch
fraction across these classes shows whether the guarantee holds as the policy changes, and
where the two layers catch different things.

The behavioral row is a slot. It takes any detector that calibrates on successful rollouts
and thresholds with conformal prediction, which is what the recent papers all do. SPAR
doesn't ship its own; it ships STAC, FAIL-Detect, and FIPER as reference plug-ins.

## Architecture

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
│  Mission layer              (UNTRUSTED)     │  ◀── operator selects active behavior
│  Hand-coded behaviors · learned nodes       │
└────────────────────┬────────────────────────┘
                     │ command stream
                     ▼
┌─────────────────────────────────────────────┐
│  Runtime monitor            (TRUSTED)       │
│  bounds · rate-of-change · staleness        │
│  approve → adapter   reject → safe fallback │
└────────────────────┬────────────────────────┘
                     │ approved command, or defined safe fallback on reject
                     ▼
┌─────────────────────────────────────────────┐
│  ControllerAdapter          (TRUSTED)       │
│  single writer · transport plugin           │
└─────────────────────────────────────────────┘
```

**Observation assembler.** The same assembler, the same `latest_at_or_before(t)` lookup,
and the same staleness math run in simulation and on the rover; only the source
implementation changes. State estimation is upstream and external — SPAR consumes an
estimated pose and velocity (e.g., the platform's `robot_localization` EKF), it never
produces one. For hand-coded behaviors and the SAC RL baseline, the assembled
snapshot is the policy's primary input. For vision-based policies (Cosmos, Phase 4a), raw
video frames flow through a separate path, but the assembler still runs, because the
monitor needs assembled state (pose age, speed) to gate every command regardless of what
produced it.

**Runtime monitor.** Sees every command before the adapter. Enforces per-sample bounds,
rate-of-change limits, and temporal-window invariants derived from the active
`ControllerEnvelope` — the controller's accepted command limits. Every decision is logged with the triggered invariant and an
`invariant_flags` bitmask so the post-mortem question is always answerable: did no
applicable invariant exist, or did one exist and the monitor miss it?

**Rejection contract.** A rejected command is never silently dropped. The monitor puts a
**defined safe fallback** in its place and logs the rejection with the triggered
`invariant_flags`. The fallback is what keeps the vehicle safe; a flagged command does
nothing on its own. It's configurable per deployment: commanded-stop/zero (the default),
hold-last-approved, or — where the controller provides one — hand-off to a
controller-native failsafe mode.

**Single-writer adapter.** The `ControllerAdapter` is the only module that links against
the controller transport; bypass is architecturally impossible, not merely prohibited.
Adapters are named by transport, not vehicle: the reference is `Ros2Adapter` (diff-drive
`cmd_vel`, demoed on the Clearpath Husky), with `MavlinkAdapter` a second profile for
ArduPilot vehicles.

## Where SPAR Sits

SPAR is the within-platform half of the composition story: the authority boundary on each vehicle. The cross-platform half is [Tower](tower.md), which composes vehicles into a fleet. The two boundaries are independent: SPAR without Tower, or Tower without SPAR, are both valid configurations.

!!! tip "Source"

    [SPAR on GitHub](https://github.com/EthanMBoos/SPAR) — architecture, eval protocol, and RL pipeline docs in `docs/`.
