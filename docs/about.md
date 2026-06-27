---
icon: lucide/bot
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building the infrastructure for deploying learned robot autonomy in the real world.

Robot autonomy is becoming more capable and more opaque at the same time. Hand-coded behavior trees are giving way to learned policies; learned policies are giving way to monolithic models that decode motor commands directly from pre-trained video. Policy capability is scaling faster than our ability to verify it, so certifying the whole stack stops being the right question. The right one is what *contract* sits between the opaque parts and the parts you trust, and whether it holds when what's above it changes.

We treat this at two layers, and the same architectural argument shows up at both:

- **Across platforms.** The [pidgin protocol](pidgin.md) is the wire contract that composes heterogeneous vehicles into a single fleet through a capability-aware Physical API. Vehicles advertise capabilities; the protocol validates commands against them before routing. New vehicle types plug in as protobuf extensions with no core changes. The protocol stands on its own; any autonomy stack, GCS, or middleware can adopt it without buying into anything else we build. [Tower](tower.md) is our reference operator UI on top of it.
- **Within a platform.** [SPAR](spar.md) is a C++ runtime built around a command authority boundary. It guarantees invariance by construction across two substitution axes: the source of an observation (simulation vs. hardware) and the behavior that consumes it (hand-coded vs. learned policy), leaving the policy as the only free variable. A trusted observation assembler makes both sources look identical to the mission layer; a trusted monitor and single-writer adapter decide what commands cross to the controller. Field a learned policy without certifying it: every command it emits is gated, rejected ones hand off to a defined fallback, and the logs reconstruct what the monitor saw and did. What the boundary catches, and the residual it can't, is measured rather than assumed.

Same pattern at both levels: keep the seams small, and vehicles, transports, and autonomy can change without breaking them. The two aren't symmetric in stakes, though. The pidgin seam decides whether new vehicles compose into a fleet; the authority boundary decides what a learned policy is allowed to command, which is why we can field one without verifying it. If the policy crashes, the autopilot stays up. If the vehicle crashes, the recordings tell us which side failed.

The initial demo targets a ground rover on ArduPilot Rover SITL with Gazebo; the same authority split is intended for later aerial vehicles.

!!! tip "Still in beta, still useful"

    [Tower](https://github.com/EthanMBoos/Tower) is in beta but already stable enough to back multi-domain research.

## Explore

<div class="grid cards" markdown>

-   :lucide-book-open:{ .lg .middle } **Course Home**

    ---

    The VIP structure, what students contribute, and how the two research tracks fit together.

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

    The within-platform authority boundary: every policy command vetted before it reaches the controller, with a defined fallback on reject.

    [:octicons-arrow-right-24: Learn more](spar.md)

</div>

