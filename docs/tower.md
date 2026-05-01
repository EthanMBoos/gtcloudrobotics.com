---
icon: lucide/route
hide:
- toc
---

# Tower Interface

<figure markdown="span">
  ![Tower operator UI](assets/images/TowerPreview.png)
  <figcaption>Tower operator UI — 3D mission planning and fleet monitoring.</figcaption>
</figure>

**Tower** is an open-architecture command and control system for heterogeneous robotic fleets — pairing an Electron + React [operator UI](https://github.com/EthanMBoos/Tower) with a Go [tower-server](https://github.com/EthanMBoos/tower-server) that bridges vehicles over the pidgin protocol.

The UI handles 3D mission planning, fleet monitoring, and LLM-assisted operations. tower-server handles protocol translation, telemetry aggregation, and command routing — so the UI stays clean while new vehicle types plug in as extensions.

```text
┌──────────────┐    UDP multicast    ┌──────────────┐    WebSocket     ┌──────────────┐
│   Vehicles   │ ◀─────────────────▶ │ tower-server │ ◀───────────────▶│  Operator UI │
│   protobuf   │                     │     (Go)     │   JSON frames    │  (Electron)  │
└──────────────┘                     └──────────────┘                  └──────────────┘
```

!!! tip "Dive deeper"

    Read the [pidgin protocol spec](https://github.com/EthanMBoos/tower-server/blob/main/docs/PROTOCOL.md) or the [UI architecture overview](https://github.com/EthanMBoos/Tower/blob/main/docs/ARCHITECTURE.md).
