---
icon: lucide/layers
hide:
- toc
---

# Modular Autonomy Framework

<figure markdown="span">
  ![Starling reference platform](assets/images/starling.png)
  <figcaption>ModalAI Starling 2 — initial target platform for MAF deployment.</figcaption>
</figure>

**MAF** is a C++ mission and integration layer built around PX4, with MAF-owned contracts between modules carried over a narrow transport layer. [Zenoh](https://zenoh.io/) is the current default transport, but the contract boundary is designed to stay stable across other transport adapters as needed. PX4 owns flight control, estimation, and failsafes; [MAF Aerial](https://github.com/EthanMBoos/maf_aerial) owns mission sequencing, telemetry normalization, and the external command boundary. Keeping the core in plain C++ — rather than in ROS nodes — means the live middleware graph never becomes the application model; ROS can still wrap sensor drivers, perception packages, or bagging at the edges, but it adapts the contract instead of defining it.

The durable boundary is a **small set of MAF-owned contracts around the autopilot**, kept narrow and explicit so it stays stable as vehicles and interfaces change. That same boundary is what makes later learning work operationally: replay, recording, and model-serving processes can sit below mission and above raw sensors without collapsing the PX4-centered safety split into an opaque deployment graph. Phase 1 ships as two processes per vehicle — `maf_aerial` (mission BT + PX4 adapter + gateway link co-located) and `maf_recorder` standalone, so a runtime crash never takes the black box down with it. Explicit C++ loops own behavior. A small supervisor state machine gates mission authority, `maf_px4_adapter` is the only module that writes PX4-facing offboard commands, and the vehicle plugs into [Tower](https://github.com/EthanMBoos/Tower) by publishing a protobuf extension payload to [tower-server](https://github.com/EthanMBoos/tower-server).

```text
┌──────────────┐   MAVLink    ┌──────────────┐   Protobuf    ┌──────────────┐
│   Autopilot  │ ◀──────────▶ │  maf_aerial  │ ◀───────────▶ │ tower-server │
│    (PX4)     │              │(C++/Zenoh/BT)│   extension   │     (Go)     │
└──────────────┘              └──────────────┘               └──────────────┘
```

!!! tip "Dive deeper"

  Read the [architecture decisions](https://github.com/EthanMBoos/maf_aerial/blob/main/docs/ARCHITECTURE_DECISIONS.md) for the PX4-centered model, [runtime composition](https://github.com/EthanMBoos/maf_aerial/blob/main/docs/RUNTIME_COMPOSITION.md) for the two-process layout and promotion criteria for further splits, or [learning architecture](https://github.com/EthanMBoos/maf_aerial/blob/main/docs/LEARNING_ARCHITECTURE.md) for how replay, data capture, and model-serving fit into the same boundary without weakening flight authority.
