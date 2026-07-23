---
icon: lucide/layers
hide:
- toc
---

# SPAR - Sim Portable Autonomy Runtime

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/spar){ .md-button }

**SPAR** is a hybrid-autonomy runtime. A small C++ behavior tree owns the mission, the vehicle's motion controller (Nav2 on the ground, PX4 in the air) owns movement, and a Unity + MuJoCo simulator stands in for the world. Learned components, RL policies and vision models, plug in at fixed seams in that stack rather than replacing it.

The motivation: RL and vision-language models are advancing fast, and the open question for robots is not capability but reliability over a long, unsupervised mission. SPAR keeps the mission logic deterministic and legible, gives learned components specific jobs behind stable interfaces, and uses simulation to run the scenarios and regressions that tell you whether the combination holds up.

## One Substrate

MuJoCo is the physics and Unity sits on top of it. The MuJoCo plugin runs the physics inside the Unity process, so rendering, drag-and-drop world authoring, and the robot all share one world. A C# sensor layer computes the ROS topics (clock, odometry, TF, lidar, camera, detections) directly from MuJoCo state and ships them over TCP to a Docker container that runs everything else: the behavior tree and each vehicle's motion stack, Nav2 and AMCL for the ground robot, PX4 for the drone. There is no simulator in the container.

```text
        ┌────── container (ROS): behavior tree / Nav2 · AMCL / PX4 ──────┐
        │        pure ROS + the :10000 endpoint Unity connects to        │
        └───────────────────────────▲────────────────────────────────────┘
                                    │ ROS-TCP
        ┌───────────────────────────┴────────────────────────────────────┐
        │   one substrate: Unity + MuJoCo plugin (physics in-process)    │
        │   one C# sensor layer · the scene IS the world                 │
        │   MJCF flows OUT only: dump → lint → rasterize (make map)      │
        └────────────────────────────────────────────────────────────────┘
```

The Unity scene is the world. Nothing is generated into it; the model only flows out. `make map` dumps the exact MJCF the plugin compiled, runs it through a lint gate (geometry the robot can hit but its lidar can't see, blocked docks and waypoints), and rasterizes the occupancy map AMCL localizes against, so the map can never drift from the world. The lidar map and AMCL are the ground robot's localization; the drone relies on PX4's own state estimation. The same scene runs windowed for authoring and demos, or headless for automated tests, with the same physics and sensors either way. Everything runs on tools that aren't vendor locked: Unity for rendering, MuJoCo for physics, standard ROS 2 in the container.

## The Behavior Layer

The tree is BehaviorTree.CPP, ticked at 10 Hz on sim time. Priority reads top to bottom: an active mission gates everything, low battery preempts inspection, a fresh detection preempts the patrol, and every branch bottoms out in holding position rather than undefined behavior.

```text
    ReactiveFallback (root)
    ├── ReactiveSequence (mission gate)
    │   ├── MissionActive?
    │   └── ReactiveFallback (on mission)
    │       ├── BatteryLow?   → ReturnToDock, else HoldPosition
    │       ├── AnomalySeen?  → Inspect
    │       ├── Rounds
    │       └── HoldPosition
    └── Idle
```

Every composite is reactive: the whole tree re-evaluates every tick, so a battery that drops mid-inspection redirects the robot on the next tick with no hand-written transition. Leaves own the motion-stack calls (Nav2 actions on the ground, PX4 commands in the air), with retry cooldowns and goal preemption handled locally. Conditions own freshness: a battery reading older than its staleness window counts as low, because a value you can't trust is treated the same as a bad one. All tuning (waypoints, dock pose, thresholds, cooldowns) lives in one YAML per world and is injected at registration time, so the tree XML stays pure shape. Every tick, the executive publishes a JSON status line on `bt/status`: root status, active leaf, mission state, battery level and age.

## Where Learned Components Plug In

Two seams, both already load-bearing:

**Perception.** The camera is real in every run: Unity renders color and depth, and a detector node in the container turns pixels into a labeled map-frame point on `perception/detections`. Today that detector is classical blob-finding, but the message is deliberately generic (header, label, point), so a pretrained VLM or segmentation model can replace it and report whatever classes it sees without the topic or the tree changing. The tree filters by label at the subscription. Vision models enter this stack as perception, not control.

**Behavior.** A tree leaf is just a node that produces commands while it runs. A trained policy can occupy a leaf the same way the hand-written `Rounds` or `Inspect` leaves do, arbitrated by the same tree, preempted by the same battery condition.

## What's Being Researched

> Can a deterministic behavior layer and learned components share one stack, swapping the learned parts in and out without destabilizing the rest?

> Where does a learned policy actually beat the hand-written tree, and what evidence from simulation would justify trusting it with a long mission?

The architecture buys one specific trick for answering these. Because MuJoCo is the physics inside Unity *and* in a plain Python process, the dumped world is the exact model the sim runs. So training can leave the heavy stack behind entirely:

```text
    Unity scene (authored world)
      └── make map  →  the exact compiled MJCF model
            └── pure-MuJoCo Gymnasium env (no ROS, no Unity, fast)
                  └── train a policy on low-dimensional state
                        └── deploy it as a behavior node
                              └── eval in the full Unity + ROS stack
```

The policy never crosses a physics boundary between training and evaluation. The first head-to-heads are a learned local planner against Nav2's, and a learned executive against the hand-written tree, on the same worlds with the same pass bar the smoke tests already enforce. The MJCF dump ships today; the Gymnasium wrapper and the deploy path are the open work, with the full design in the repo's [rl.md](https://github.com/EthanMBoos/spar/blob/main/docs/rl.md). Learning from pixels is deliberately out of scope: rendering throttles sampling by orders of magnitude, and pretrained models already cover recognition through the perception seam.

## Where SPAR Sits

SPAR is the autonomy runtime on each vehicle: the mission logic, the motion stack, and the seams where learned components plug in, developed and stressed entirely in simulation before anything touches hardware.

!!! tip "Dive deeper"

    Read the repo's [simulation architecture](https://github.com/EthanMBoos/spar/blob/main/docs/sim-architecture.md) and [RL design](https://github.com/EthanMBoos/spar/blob/main/docs/rl.md) docs, or start from the [README quickstart](https://github.com/EthanMBoos/spar#quickstart).
