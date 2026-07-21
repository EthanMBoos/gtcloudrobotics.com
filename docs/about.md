---
icon: lucide/bot
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building infrastructure for deploying learned robot autonomy in the real world. This page is the short version of what we build and why; for tracks, demo cycles, and logistics, see [Course Home](course-home.md).

Robot autonomy is becoming more capable and more opaque at the same time. Hand-coded behavior trees are giving way to learned policies; learned policies are giving way to monolithic models that decode motor commands directly from pre-trained video. Connecting one of these models to a robot is easy. Making it work inside an existing autonomy stack, and verifying the full system across enough scenarios to trust it with a long-time horizon job, is not. That is the problem we work on, and it shows up at two scales.

Within a vehicle, [SPAR](spar.md) is a hybrid-autonomy runtime: a deterministic behavior tree owns the mission, the motion stack (Nav2 on the ground, PX4 in the air) owns movement, and learned components take on specific jobs, a trained policy as a behavior node, a vision model behind the perception topic. The whole stack develops in a Unity + MuJoCo simulation, which is also where a learned component proves itself before it's trusted.

Across a fleet, [Tower](tower.md) gives ground, air, and marine vehicles one operator surface, built on the [pidgin protocol](pidgin.md): vehicles advertise what they support, every command is validated against that before it's forwarded, and new vehicle types join as protocol extensions. Pidgin stands on its own; any autonomy stack or GCS can adopt it without anything else we build.

The reference demo is a simulated Clearpath Husky and a Skydio drone making inspection rounds of the same site: patrolling waypoints, investigating what perception reports, and docking when the battery runs low.

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

