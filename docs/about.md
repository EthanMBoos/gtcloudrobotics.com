---
icon: lucide/rocket
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building open-architecture systems that work with any autonomous robotics platform — land, air, or sea.

Most software systems are trapped in a single domain. Drone GCS software rarely handles ground robots, marine systems can't visualize UAVs, and mixing platforms usually means juggling multiple apps with incompatible data formats. This fragmentation forces developers to waste months on repetitive integration or maintain entirely separate codebases for every new vehicle they introduce. It’s a "siloing" problem where the most basic tasks take months due to rigid initial design.

The [OpenC2 protocol](https://github.com/EthanMBoos/openc2-gateway/blob/main/docs/PROTOCOL.md) is a fresh take on what a modern, heterogeneous robotic fleet needs to thrive. We built this from first principles, utilizing a **core protocol and extension architecture** that eliminates the need for ecosystem-wide changes. The beauty of it is that you don’t need everyone else to change; they just need to adjust their protobuf to wrap cleanly into our system once. From there, they’re part of the ecosystem forever.

```text
                        VEHICLE ↔ GATEWAY                    GATEWAY ↔ UI
                       (protobuf/UDP multicast)              (JSON/WebSocket)

┌─────────────┐                           ┌─────────────┐                    ┌─────────────┐
│   Vehicle   │                           │   Gateway   │                    │     UI      │
└──────┬──────┘                           └──────┬──────┘                    └──────┬──────┘
       │                                         │                                  │
       │◀───── GatewayHeartbeat (1/sec) ─────────│                                  │
       │                                         │◀────────── hello ────────────────│
       │                                         │─────────── welcome ─────────────▶│
       │                                         │            (fleet, manifests,    │
       │                                         │             availableExtensions) │
       │                                         │                                  │
       │────── VehicleTelemetry ────────────────▶│─────────── telemetry ───────────▶│
       │────── Heartbeat (capabilities) ────────▶│                                  │
       │                                         │                                  │
       │◀───── Command ──────────────────────────│◀────────── command ──────────────│
       │────── CommandAck ──────────────────────▶│─────────── command_ack ─────────▶│
```

At the heart of the framework is a gateway using an **envelope protocol** — common fields like position, heading, and status, plus extension payloads for vehicle-specific data. Adding a new platform (Skydio, Husky, BlueBoat) means writing one extension, not forking the codebase.

!!! tip "Still in beta, still useful"

    [OpenC2](https://github.com/EthanMBoos/OpenC2) is in beta but already stable enough to back multi-domain research — stop fighting protocols and focus on autonomy.

Learn more about our work:

<div class="grid cards" markdown>

-   :lucide-book-open:{ .lg .middle } **Course Home**

    ---

    Start here for an overview of the course structure, schedule, and expectations.

    [:octicons-arrow-right-24: Go to course](course-home.md)

-   :lucide-route:{ .lg .middle } **OpenC2 Protocol**

    ---

    Dive into the envelope protocol and extension architecture powering the gateway.

    [:octicons-arrow-right-24: Read the spec](openc2.md)

-   :lucide-cpu:{ .lg .middle } **Technologies**

    ---

    The cloud-native tooling, messaging patterns, and frameworks we build on.

    [:octicons-arrow-right-24: See the stack](technologies.md)

-   :lucide-layers:{ .lg .middle } **Modular Autonomy Framework**

    ---

    How MAF composes behaviors, planners, and controllers across heterogeneous platforms.

    [:octicons-arrow-right-24: Learn more](maf.md)

</div>

