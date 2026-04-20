---
icon: lucide/route
hide:
- toc
---

# OpenC2 Interface

![OpenC2 operator UI](assets/images/OpenC2Preview.png)
<caption>OpenC2 operator UI — 3D mission planning and fleet monitoring.</caption>

**OpenC2** is an open-architecture command and control system for heterogeneous robotic fleets — pairing an Electron + React [operator UI](https://github.com/EthanMBoos/OpenC2) with a Go [gateway](https://github.com/EthanMBoos/openc2-gateway) that bridges vehicles over a protobuf envelope protocol.

The UI handles 3D mission planning, fleet monitoring, and LLM-assisted operations. The gateway handles protocol translation, telemetry aggregation, and command routing — so the UI stays clean while new vehicle types plug in as extensions.

```text
┌──────────────┐    UDP multicast    ┌──────────────┐    WebSocket     ┌──────────────┐
│   Vehicles   │ ◀─────────────────▶ │   Gateway    │ ◀───────────────▶│  Operator UI │
│   protobuf   │                     │   (Go)       │   JSON frames    │  (Electron)  │
└──────────────┘                     └──────────────┘                  └──────────────┘
```

!!! tip "Dive deeper"

    Read the [wire protocol spec](https://github.com/EthanMBoos/openc2-gateway/blob/main/docs/PROTOCOL.md) or the [UI architecture overview](https://github.com/EthanMBoos/OpenC2/blob/main/docs/ARCHITECTURE.md).
