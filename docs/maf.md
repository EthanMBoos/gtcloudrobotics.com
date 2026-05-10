---
icon: lucide/layers
hide:
- toc
---

# Modular Autonomy Framework

<figure markdown="span">
  ![Starling reference platform](assets/images/starling.png)
  <figcaption>ModalAI Starling 2 remains a future aerial target; the initial MAF demo will run on an ArduPilot-based ground rover.</figcaption>
</figure>

**MAF** is a C++ mission and integration layer built around ArduPilot, with MAF-owned contracts between modules carried over a narrow transport layer. [Zenoh](https://zenoh.io/) is the current default transport, but the contract boundary is designed to stay stable across other transport adapters as needed. ArduPilot owns low-level vehicle control, state estimation, and failsafes; the MAF runtime owns mission sequencing, telemetry normalization, and the external command boundary. Keeping the core in plain C++ — rather than in ROS nodes — means the live middleware graph never becomes the application model; ROS can still wrap sensor drivers, perception packages, or bagging at the edges, but it adapts the contract instead of defining it.

The durable boundary is a **small set of MAF-owned contracts around the autopilot**, kept narrow and explicit so it stays stable as vehicles and interfaces change. That boundary is also what makes staged autonomy practical: replay, recording, and model-serving can sit below mission and above raw sensors without collapsing the ArduPilot-centered safety split into an opaque deployment graph. The initial demo targets a ground rover, which keeps the first integration loop simple while preserving the same authority split intended for later aerial vehicles. Phase 1 still ships as two processes per vehicle — the MAF runtime (mission BT + ArduPilot adapter + gateway link co-located) and `maf_recorder` standalone, so a runtime crash never takes the black box down with it. Explicit C++ loops own behavior, a small supervisor state machine gates mission authority, the autopilot adapter remains the only module that writes ArduPilot-facing commands, and the vehicle plugs into [Tower](https://github.com/EthanMBoos/Tower) by publishing a protobuf extension payload to [tower-server](https://github.com/EthanMBoos/tower-server), creating a clean runtime seam for learning.

**Future work:** MAF stays compatible with Isaac Sim and related simulation stacks because the authority split stays intact: ArduPilot remains active for low-level control, estimation, and failsafes, while simulation and learning systems train and evaluate perception and mission-level policies above it. For the rover demo, that means policy or planner outputs still flow through the same BT and autopilot-adapter boundary used by deterministic planners. Later aerial deployments can reuse that same goal-context input, command-stream output, and termination semantics from simulation to field, preserving replayability and crash isolation without weakening the ArduPilot-centered safety model.

```text
┌──────────────┐   MAVLink    ┌──────────────┐   Protobuf    ┌──────────────┐
│   Autopilot  │ ◀──────────▶ │     MAF      │ ◀───────────▶ │ tower-server │
│ (ArduPilot)  │              │(C++/Zenoh/BT)│   extension   │     (Go)     │
└──────────────┘              └──────────────┘               └──────────────┘
```

!!! tip "Dive deeper"

  The linked design notes in [maf_aerial](https://github.com/EthanMBoos/maf_aerial) still capture the earlier PX4-centered aerial cut. They remain useful background on the two-process layout, learning boundary, and promotion criteria for further splits, but they need a follow-up pass to fully match the new ArduPilot rover-first direction described here.
