---
icon: lucide/bot
hide:
- toc
---

# What is GT Cloud Robotics?
A Georgia Tech [Vertically Integrated Projects](https://vip.gatech.edu/) team building open-architecture infrastructure for fielding modern, learned robot autonomy.

Robot autonomy is becoming more capable and more opaque at the same time. Hand-coded behavior trees are giving way to learned policies; learned policies are giving way to monolithic models that decode motor commands directly from pre-trained video. Policy capability is scaling faster than our ability to verify it — so certifying the whole stack stops being the right question. The right one is what *contract* sits between the opaque parts and the parts you trust, and whether it holds when what's above it changes.

We treat this at two layers — and the same architectural argument shows up at both:

- **Across platforms.** The [pidgin protocol](pidgin.md) is the wire contract that composes heterogeneous vehicles into a single fleet through a capability-aware Physical API. Vehicles advertise what they can do; commands are validated against those capabilities before routing; new vehicle types plug in as protobuf extensions without touching the core. The protocol stands on its own — any autonomy stack, GCS, or middleware can adopt it without buying into anything else we build. [Tower](tower.md) is our reference operator UI on top of it.
- **Within a platform.** [MAF](maf.md) is a C++ mission and integration runtime built around the authority boundary between high-level autonomy and the trusted low-level controller. A runtime monitor decides what commands cross it, a single-writer adapter is the only module in the system permitted to write to the controller, and a crash-isolated recorder captures enough state that fault class is recoverable from artifacts alone. The certified surface stays small while the policy above can scale arbitrarily — hand-coded behavior tree, single learned BT node, or monolithic policy replacing the entire autonomy layer, the monitor, adapter, recording schema, and admission step stay the same.

Same pattern at both levels: keep the seams small, and vehicles, transports, and autonomy can change without breaking them. The two aren't symmetric in stakes, though — the pidgin seam decides whether new vehicles compose into a fleet; the authority boundary decides what a learned policy is allowed to command, which is why we can field one without verifying it. If the policy crashes, the autopilot stays up. If the vehicle crashes, the recordings tell us which side failed.

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

-   :lucide-network:{ .lg .middle } **Pidgin Protocol**

    ---

    The cross-platform wire contract — vehicles advertise capabilities and plug in via versioned extensions, no protocol fork required.

    [:octicons-arrow-right-24: See the protocol](pidgin.md)

-   :lucide-layers:{ .lg .middle } **Modular Autonomy Framework**

    ---

    The on-vehicle authority boundary — what a learned policy is allowed to command, and what the trusted controller is guaranteed.

    [:octicons-arrow-right-24: Learn more](maf.md)

</div>

