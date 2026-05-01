---
icon: lucide/bot
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building open-architecture systems that work with any autonomous robotics platform — land, air, or sea.

Most software systems are trapped in a single domain. Drone GCS software rarely handles ground robots, marine systems can't visualize UAVs, and mixing platforms usually means juggling multiple apps with incompatible data formats. This fragmentation forces developers to waste months on repetitive integration or maintain entirely separate codebases for every new vehicle they introduce.

Our approach treats this as a *composition* problem at every layer of the stack — protocol, on-vehicle runtime, and behavior architecture — rather than something to solve once at the protocol layer and inherit everywhere else. Three pieces compose into one heterogeneous-fleet stack, but each is independently adoptable:

- **Protocol layer.** The [pidgin protocol](pidgin.md) — a core protocol with an extension architecture. Other systems only need to wrap their protobuf to plug in; once that's done, they're part of the ecosystem permanently. The protocol stands on its own: any autonomy stack, GCS, or middleware can adopt it without buying into anything else we build.
- **On-vehicle runtime.** A C++ mission and integration layer ([MAF](maf.md)) built around a small set of MAF-owned contracts at the autopilot boundary — explicit C++ loops own behavior, so the live middleware graph never becomes the application model and the contract stays stable as vehicles and transports change.
- **Behavior architecture.** Standalone BehaviorTree.CPP nodes plus a layered config hierarchy that give custom per-vehicle logic an obvious place to live and shared logic an equally obvious place to be promoted to — so extending the system stays clean as more vehicles and behaviors are implemented.

!!! tip "Still in beta, still useful"

    [Tower](https://github.com/EthanMBoos/Tower) is in beta but already stable enough to back multi-domain research — stop fighting protocols and focus on autonomy.

## Explore

<div class="grid cards" markdown>

-   :lucide-book-open:{ .lg .middle } **Course Home**

    ---

    Start here for an overview of the course structure, schedule, and expectations.

    [:octicons-arrow-right-24: Go to course](course-home.md)

-   :lucide-radio-tower:{ .lg .middle } **Tower C2**

    ---

    The operator UI and tower-server bridge — 3D mission planning and fleet monitoring across heterogeneous vehicles.

    [:octicons-arrow-right-24: See Tower](tower.md)

-   :lucide-cpu:{ .lg .middle } **Technologies**

    ---

    The cloud-native tooling, messaging patterns, and frameworks we build on.

    [:octicons-arrow-right-24: See the stack](technologies.md)

-   :lucide-layers:{ .lg .middle } **Modular Autonomy Framework**

    ---

    How MAF composes behaviors, planners, and controllers across heterogeneous platforms.

    [:octicons-arrow-right-24: Learn more](maf.md)

</div>

