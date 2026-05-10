---
icon: lucide/route
hide:
- toc
---

# Tower C2

<figure markdown="span">
  ![Tower operator UI](assets/images/TowerPreview.png)
  <figcaption>Tower operator UI — 3D mission planning and fleet monitoring.</figcaption>
</figure>

Most fleet software is trapped in a single domain. Drone GCS rarely handles ground robots, marine systems can't visualize UAVs, and mixing platforms usually means juggling multiple apps with incompatible data formats — months wasted on repetitive integration, or separate codebases for every new vehicle.

The alternative most fleets settle on — a unified dashboard that flattens vehicles into a lowest-common-denominator interface — has its own failure mode: silent execution failures where a ground rover quietly receives a "take off" command, or a stationary manipulator is queried for GPS waypoints, with no error and no warning until something physically goes wrong.

**Tower** is an open-architecture command and control system for heterogeneous robotic fleets that threads the needle between those two extremes. It pairs an Electron + React [operator UI](https://github.com/EthanMBoos/Tower) with a Go [tower-server](https://github.com/EthanMBoos/tower-server) that bridges vehicles over the [pidgin protocol](pidgin.md). Vehicles share one operator surface, but no operator action ever bypasses what the receiving vehicle says it can do.

```text
┌──────────────┐    UDP multicast    ┌──────────────┐    WebSocket     ┌──────────────┐
│   Vehicles   │ ◀─────────────────▶ │ tower-server │ ◀───────────────▶│  Operator UI │
│   protobuf   │                     │     (Go)     │   JSON frames    │  (Electron)  │
└──────────────┘                     └──────────────┘                  └──────────────┘
```

## The Operator Surface

The Tower UI is built for operators running mixed fleets, not vehicle-specific consoles bolted onto each other. Several things happen in one shared scene rather than one per platform:

- **3D mission planning.** Geospatial waypointing, area coverage, and multi-vehicle coordination across air, ground, and stationary assets in a single planner.
- **Fleet monitoring.** Live telemetry from every connected vehicle on one map and in one status panel, with platform-specific detail surfaced through extensions rather than hidden behind generic widgets.
- **Capability-aware command panels.** The UI renders only the controls each selected vehicle has actually advertised at runtime, so an operator never sees a button that maps to an action the receiving vehicle can't accept. The server backs this with a hard validation step; the UI just consumes the result.
- **LLM-assisted operations.** Natural-language operator intents are grounded against the same capability data the command panels use, so the model can't propose actions a vehicle doesn't support — the legibility guarantees that hold for the human operator hold for the assistant too.

The result is a tighter operator experience: one map, one mission timeline, and one command surface across heterogeneous assets, without pretending that a stationary hub can fly or that a drone can charge a partner.

## tower-server: Translation and Validation

`tower-server` is the bridge between the multicast protobuf world the vehicles speak and the WebSocket JSON world the UI consumes. It owns four responsibilities:

- **Protocol translation.** Decode pidgin core and extension payloads from protobuf into JSON for the UI; encode operator commands the other direction. Keeps the protobuf runtime and per-extension binary handling out of the browser.
- **Telemetry aggregation.** Maintain the fleet snapshot from incoming `VehicleTelemetry` and `Heartbeat` messages, fan it out to connected operator clients, and publish the `welcome` message that bootstraps each session with the current fleet, manifests, and available extensions.
- **Command validation.** Cross-reference every operator command against the receiving vehicle's advertised capabilities before forwarding it. Out-of-capability commands are rejected at the server, not the vehicle, and the rejection reason flows back to the UI as structured data the operator can act on.
- **Command routing.** Deliver validated commands to the addressed vehicle and surface the lifecycle (`accepted`, `rejected`, `timeout`, `completed`, `failed`) back to the operator who issued them.

That split is what lets the UI stay clean: it doesn't see protobuf, doesn't manage extension codecs, and doesn't validate commands itself. It asks the server what's possible and renders accordingly.

## A Capability-Aware Physical API

Cross-platform composition rests on the protocol seam. Vehicles advertise capabilities through [pidgin](pidgin.md); `tower-server` validates every operator action against those capabilities before routing it; new vehicle types plug in by registering a versioned extension rather than forking the core. The operator surface treats heterogeneous vehicles uniformly when their capabilities overlap and surfaces real differences at the right layer — see [the pidgin page](pidgin.md) for envelope, extensions, and capability mechanics.

`tower-server` is one bridge implementation. Because pidgin stands on its own, other autonomy stacks, GCSes, or middlewares can adopt the protocol without buying into Tower.

## Designed for Heterogeneous Fleets

The motivating workload is mixed-domain operations where each platform has a meaningfully different command surface and operational envelope. A last-mile delivery scenario — ground rovers navigating sidewalks and parking lots, aerial drones handling rooftop and hard-to-reach drops, and stationary hubs managing handoff and charging — exercises the boundary cases the architecture was built for: vehicles that share some commands (mission start/stop, waypoint queue, status reporting) but disagree on others (altitude, payload manipulation, charge state).

Operators see one map, one mission timeline, and one command surface across all three classes. Vehicle differences are surfaced where they're actionable; vehicle commonalities are pooled where they're useful. Adding a new platform class is mostly extension-mapping work at the edge — see the [pidgin integration contract](pidgin.md#integration-contract) for what that looks like in practice — rather than central bridge maintenance in the middle.

## Where Tower Sits in the Stack

Tower is the **cross-platform** half of our composition story — it composes vehicles into a fleet through the protocol seam. The **within-platform** half is the [MAF](maf.md) authority boundary on each vehicle. Vehicles plug into Tower by publishing a pidgin extension payload at one end of the runtime; MAF enforces the autopilot-facing contract at the other. The two boundaries are independent: you can adopt pidgin without MAF, or MAF without Tower.

!!! tip "Dive deeper"

    Read the [pidgin protocol spec](https://github.com/EthanMBoos/tower-server/blob/main/docs/PROTOCOL.md) or the [UI architecture overview](https://github.com/EthanMBoos/Tower/blob/main/docs/ARCHITECTURE.md).
