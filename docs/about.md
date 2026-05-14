---
icon: lucide/bot
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building open-architecture infrastructure for fielding modern, learned robot autonomy.

Robot autonomy is becoming more capable and more opaque at the same time. Hand-coded behavior trees are giving way to learned policies; learned policies are giving way to monolithic models that decode motor commands directly from pre-trained video. Policy capability is scaling faster than our ability to verify it — so certifying the whole stack stops being the right question. The right one is what *contract* sits between the opaque parts and the parts you trust, and whether that contract holds when what's above it changes.

We treat this as a *composition* problem at two layers — and the same architectural argument shows up at both:

- **Across platforms.** [Tower and the pidgin protocol](tower.md) compose heterogeneous vehicles into a single fleet through a capability-aware Physical API. Vehicles advertise what they can do; tower-server validates commands against those capabilities; new vehicle types plug in as protobuf extensions without touching the core. The protocol stands on its own — any autonomy stack, GCS, or middleware can adopt it without buying into anything else we build.
- **Within a platform.** [MAF](maf.md) is a C++ on-vehicle runtime built around an *authority-boundary contract* between high-level autonomy and the certified low-level autopilot. ArduPilot owns vehicle control; MAF owns mission sequencing; a runtime monitor enforces what crosses the boundary. The contract is *scale-invariant* — whether commands come from a hand-coded behavior tree, a single learned BT node, or a monolithic policy replacing the entire autonomy layer, the enforcement substrate, recording schema, and operational properties are the same.

Same pattern at both levels: keep the contracts at the seams small, and vehicles, transports, and autonomy can change without breaking them. The authority boundary is the one that matters most. It bounds what a learned policy can command, which is why we can field one without verifying it. If the policy crashes, the autopilot stays up. If the vehicle crashes, the recordings tell us which side failed.

The initial demo targets a ground rover on ArduPilot Rover SITL with Gazebo; the same authority split is intended for later aerial vehicles.

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

