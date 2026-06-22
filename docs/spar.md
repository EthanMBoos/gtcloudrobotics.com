---
icon: lucide/layers
hide:
- toc
---

# SPAR — Sim-Portable Autonomy Runtime

!!! note "WIP"

    Actively building this out solo, not ready for student contributors yet. Check back in 2027.

**SPAR** is a C++ research runtime built around the authority boundary between high-level autonomy and a trusted low-level controller, measuring empirically how reliably a trusted runtime monitor catches policy failures, and how that coverage changes as the policy changes. The central claim is invariance-by-construction across two substitution axes: swapping the observation source (simulation vs. hardware) and swapping the behavior (hand-coded vs. learned policy) both leave the surrounding pipeline bit-identical. The policy is the only free variable.

The primary research direction is foundation model actors (Cosmos-based VLAs) deployed through this fixed boundary. A conventional RL baseline (SAC via KinematicBackend) is built first to validate the pipeline and establish catch fractions before Cosmos data collection begins.

**The mechanism** — a trusted observation assembler delivers one time-coherent snapshot per tick to an untrusted mission layer (hand-coded or learned); every command that layer produces passes through a trusted runtime monitor before reaching the vehicle controller. The monitor is deployment-only: policies train without it so catch fractions reflect the policy's natural command distribution, not one the monitor shaped. The assembler, monitor, adapter, and session log are unchanged across experiments; the policy is the only free variable, which is what makes catch fraction vs. policy type a quantity you can measure rather than a judgment call. Swapping a hand-coded behavior tree for a trained neural policy requires changing one line; the same assembler runs identically in simulation and on hardware, so the observations a policy trains on are the observations it sees at deployment.

## Research Questions

> **Can a fixed runtime monitor reliably catch dangerous commands regardless of what policy produces them and how does that guarantee hold up as the policy changes?**

> **When an operator delegates a behavior to a learned policy, what does the monitor catch that the operator can't anticipate?**

Every design decision in this repo is evaluated against whether it produces a data point in the four-way failure partition:

| Class | Caught by |
|---|---|
| Architectural-only | Runtime monitor (bounds, rate-of-change, temporal-window) |
| Behavioral-only | Behavioral monitor (OOD scoring, task-progress judgment) |
| Both | Both layers |
| Neither | The uncatchable residual — explicit boundary of what monitoring can do |

The catch fraction across those four classes, measured as policy type changes, is the publishable contribution. The boundary architecture is the mechanism. These are not separable.

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
└────────────────────┬────────────────────────┘
                     │ approved commands only
                     ▼
┌─────────────────────────────────────────────┐
│  Adapter → ArduPilot        (TRUSTED)       │
│  single writer to controller                │
└─────────────────────────────────────────────┘
```

**Observation assembler.** The same assembler, the same `latest_at_or_before(t)` lookup, and the same staleness math run in simulation and on the rover; only the source implementation changes. For hand-coded behaviors and the SAC RL baseline, the assembled snapshot is the policy's primary input. For vision-based policies (Cosmos, Phase 4a), raw video frames flow through a separate path, but the assembler still runs, because the monitor needs assembled state (pose age, speed) to gate every command regardless of what produced it.

**Runtime monitor.** Sees every command before the adapter. Enforces per-sample bounds, rate-of-change limits, and temporal-window invariants derived from ArduPilot's accepted command envelope. Every decision is logged with the triggered invariant and an `invariant_flags` bitmask so the post-mortem question is always answerable: did no applicable invariant exist, or did one exist and the monitor miss it?

**Single-writer adapter.** The only module that links against the controller transport. Bypass is architecturally impossible, not merely prohibited.

## Where SPAR Sits

SPAR is the within-platform half of the composition story: the authority boundary on each vehicle. The cross-platform half is [Tower](tower.md), which composes vehicles into a fleet. The two boundaries are independent: SPAR without Tower, or Tower without SPAR, are both valid configurations.

!!! tip "Source"

    [SPAR on GitHub](https://github.com/EthanMBoos/SPAR) — architecture, eval protocol, and RL pipeline docs in `docs/`.
