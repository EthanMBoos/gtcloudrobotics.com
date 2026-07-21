---
icon: lucide/bot
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building the infrastructure for deploying learned robot autonomy in the real world. This page is about that infrastructure and the argument behind it; for how the course itself runs, including focus tracks, demo cycles, and logistics, see [Course Home](course-home.md).

Robot autonomy is becoming more capable and more opaque at the same time. Hand-coded behavior trees are giving way to learned policies; learned policies are giving way to monolithic models that decode motor commands directly from pre-trained video. Policy capability is scaling faster than our ability to verify it, so certifying the whole stack stops being the right question. The right one is what *contract* sits between the opaque parts and the parts you trust, and whether it holds when what's above it changes.

We treat this at two layers, and the same architectural argument shows up at both:

- **Across platforms.** The [pidgin protocol](pidgin.md) is the wire contract that composes heterogeneous vehicles into a single fleet through a capability-aware Physical API. Vehicles advertise capabilities; the protocol validates commands against them before routing. New vehicle types plug in as protobuf extensions with no core changes. The protocol stands on its own; any autonomy stack, GCS, or middleware can adopt it without buying into anything else we build. [Tower](tower.md) is our reference operator UI on top of it.
- **Within a platform.** [SPAR](spar.md) is a hybrid-autonomy runtime. A deterministic C++ behavior tree owns the mission, the vehicle's motion stack (Nav2 on the ground, PX4 in the air) owns movement, and learned components plug in at fixed seams: a trained policy as a behavior node, a vision model behind the perception topic. The tree arbitrates and preempts learned components the same way it does hand-written ones, so the mission stays legible whatever produced the behavior. The whole stack develops in a Unity + MuJoCo simulation whose worlds dump out as the exact physics model they run, so a policy trains fast with no ROS in the loop and is evaluated in the full stack without crossing a physics boundary.

Same pattern at both levels: keep the seams small, and vehicles, transports, and autonomy can change without breaking them. The pidgin seam decides whether new vehicles compose into a fleet; SPAR's seams decide where a learned component takes over, and what it has to prove in simulation before it's trusted with a mission.

The reference demo is a simulated Clearpath Husky on a ROS 2/Zenoh stack making inspection rounds of a site: patrolling waypoints, investigating what perception reports, and docking when the battery runs low, with a PX4 drone flying the same worlds.

!!! tip "Still in beta, still useful"

    [Tower](https://github.com/EthanMBoos/Tower) is in beta but already stable enough to back multi-domain research.

## Explore

<div class="grid cards" markdown>

-   :lucide-book-open:{ .lg .middle } **Course Home**

    ---

    The VIP structure, the four tracks students can pick from, and the two-week demo cycle.

    [:octicons-arrow-right-24: Go to course](course-home.md)

-   :lucide-radio-tower:{ .lg .middle } **Tower C2**

    ---

    One operator surface for heterogeneous fleets: capability-aware command routing, 3D mission planning, and no silent failures.

    [:octicons-arrow-right-24: See Tower](tower.md)

-   :lucide-network:{ .lg .middle } **Pidgin Protocol**

    ---

    The wire contract composing heterogeneous vehicles into one fleet. Adopt it independently of everything else here.

    [:octicons-arrow-right-24: See the protocol](pidgin.md)

-   :lucide-layers:{ .lg .middle } **Sim Portable Autonomy Runtime**

    ---

    The hybrid-autonomy runtime: a deterministic behavior tree with fixed seams for learned policies and vision models, stressed in a Unity + MuJoCo sim.

    [:octicons-arrow-right-24: Learn more](spar.md)

</div>

