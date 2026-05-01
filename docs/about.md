---
icon: lucide/bot
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building open-architecture systems that work with any autonomous robotics platform — land, air, or sea.

Most software systems are trapped in a single domain. Drone GCS software rarely handles ground robots, marine systems can't visualize UAVs, and mixing platforms usually means juggling multiple apps with incompatible data formats. This fragmentation forces developers to waste months on repetitive integration or maintain entirely separate codebases for every new vehicle they introduce.

Our approach treats this as a *composition* problem at every layer of the stack — protocol, on-vehicle runtime, and behavior architecture — rather than something to solve once at the protocol layer and inherit everywhere else. Three pieces compose into one heterogeneous-fleet stack, but each is independently adoptable:

- **Protocol layer.** The [pidgin protocol](https://github.com/EthanMBoos/tower-server/blob/main/docs/PROTOCOL.md) — a core protocol with an extension architecture. Other systems only need to wrap their protobuf to plug in; once that's done, they're part of the ecosystem permanently. The protocol stands on its own: any autonomy stack, GCS, or middleware can adopt it without buying into anything else we build.
- **On-vehicle runtime.** A coarse-grained C++ runtime ([MAF](maf.md)) designed to fit the CPU and memory budgets typical of embedded autonomy targets, without the middleware tax distributed runtimes impose on tightly-coupled single-host autonomy.
- **Behavior architecture.** Standalone BehaviorTree.CPP nodes plus a layered config hierarchy that give custom per-vehicle logic an obvious place to live and shared logic an equally obvious place to be promoted to — so extending the system stays clean as more vehicles and behaviors are implemented.

At the heart of the protocol layer is tower-server using an **envelope protocol** — common fields like position, heading, and status, plus extension payloads for vehicle-specific data. Adding a new platform (Skydio, Husky, BlueBoat) means writing one extension, not forking the codebase.

```text
                      VEHICLE ↔ TOWER-SERVER                TOWER-SERVER ↔ UI
                       (protobuf/UDP multicast)              (JSON/WebSocket)
                       
┌─────────────┐                           ┌─────────────┐                    ┌─────────────┐
│   Vehicle   │                           │    Server   │                    │     UI      │
└──────┬──────┘                           └──────┬──────┘                    └──────┬──────┘
       │                                         │                                  │
       │                                         │◀────────── hello ────────────────│
       │                                         │─────────── welcome ─────────────▶│
       │                                         │            (fleet, manifests,    │
       │                                         │             availableExtensions) │
       │                                         │                                  │
       │────── VehicleTelemetry ────────────────▶│─────────── telemetry ───────────▶│
       │────── Heartbeat (capabilities) ────────▶│─────────── heartbeat ───────────▶│
       │                                         │                                  │
       │◀───── Command ──────────────────────────│◀────────── command ──────────────│
       │────── CommandAck ──────────────────────▶│─────────── command_ack ─────────▶│
```

!!! tip "Still in beta, still useful"

    [Tower](https://github.com/EthanMBoos/Tower) is in beta but already stable enough to back multi-domain research — stop fighting protocols and focus on autonomy.

## Explore

<div class="grid cards" markdown>

-   :lucide-book-open:{ .lg .middle } **Course Home**

    ---

    Start here for an overview of the course structure, schedule, and expectations.

    [:octicons-arrow-right-24: Go to course](course-home.md)

-   :lucide-route:{ .lg .middle } **Pidgin Protocol**

    ---

    Dive into the envelope protocol and extension architecture powering tower-server.

    [:octicons-arrow-right-24: Read the spec](tower.md)

-   :lucide-cpu:{ .lg .middle } **Technologies**

    ---

    The cloud-native tooling, messaging patterns, and frameworks we build on.

    [:octicons-arrow-right-24: See the stack](technologies.md)

-   :lucide-layers:{ .lg .middle } **Modular Autonomy Framework**

    ---

    How MAF composes behaviors, planners, and controllers across heterogeneous platforms.

    [:octicons-arrow-right-24: Learn more](maf.md)

</div>

