---
icon: lucide/layers
hide:
- toc
---

# Worldfile

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/Worldfile){ .md-button }

**Worldfile** compiles LLM-authored Blender environments into physics-ready
MuJoCo worlds. An environment family, seed, and short brief drive a fixed set
of authoring stages. Repository code then owns coordinates, physical metadata,
collision geometry, semantic sites, export, and validation.

The current example generates an outdoor utility depot and validates it with a
Clearpath Husky, ROS 2 localization, Nav2, RGB-D perception, and a mission
behavior tree. The result is ordinary MJCF and referenced assets that run
without Blender.

```text
environment family + seed + brief
                |
                v
       staged LLM authoring
                |
                v
          Blender scene
                |
                v
       deterministic compiler
                |
                v
 MJCF + assets + robot and task sites
                |
                v
 MuJoCo + ROS mission smoke test
```

Worldfile is not another simulation format or a simulation platform. The
Blender scene is an authoring artifact. The compiled MuJoCo model is the
result.

## One process, two kinds of work

The LLM handles choices that are difficult to enumerate in procedural code:
composition, layout, object selection, local detail, and appearance. Those
choices are split into small stages, and the accepted Blender scene carries
them forward.

The compiler handles anything that must be exact. It converts coordinates,
writes asset paths and physical properties, separates visual and collision
geometry, preserves semantic names, and exports the robot spawn, dock,
perception target, and ordered navigation goals.

Validation requires one Husky spawn, matching world configuration and export
metadata, valid meshes, collision-free robot footprints at the navigation
goals, a clean MuJoCo compile, and a finite passive rollout. A scene that looks
plausible but cannot support the robot task does not pass.

## Generate and run a world

After following the repository installation guide, generate one utility depot:

```sh
make worldgen WORLD=utility_depot_40_v3 SEED=42 \
  BRIEF="a denser west storage yard with a broad central aisle"
```

The build writes MJCF and assets under `sim/worlds/`. It also writes the
matching geographic datum, dock pose, and collision-checked navigation goals
for ROS.

Run the generated world or its full mission check:

```sh
make sim WORLD=utility_depot_40_v3
make view WORLD=utility_depot_40_v3
make smoke WORLD=utility_depot_40_v3
```

The simulator owns MuJoCo state and publishes simulation time, lidar, GPS, IMU,
wheel encoders, and aligned RGB-D images. ROS owns localization, perception,
planning, and mission execution. Velocity commands return to the simulator.

```text
MuJoCo sensors
      |
      v
ROS localization and perception
      |
      v
mission behavior tree
      |
      v
Nav2 -> cmd_vel -> MuJoCo
```

## The current demonstration

The utility depot contains static buildings, storage areas, roads, barriers,
vegetation, a dock, a rounds route, and a red inspection barrel. The generated
route and task sites are inputs to the same autonomy stack used by the smoke
test; they are not labels used only for presentation.

The unattended test checks the complete mission lifecycle. The Husky starts
idle, begins rounds on command, detects and inspects the red barrel through the
RGB-D pipeline, resumes rounds, returns to its dock when the simulated battery
is low, recharges, resumes again, and stops on command.

That path exercises world geometry, collision meshes, spawn placement, route
clearance, task sites, camera visibility, localization, planning, perception,
and behavior execution. Loading the XML alone would not catch most of those
failures.

## Current limits

The generated environment is static and the task uses one ground robot, one
perception target, and navigation goals. It does not include dynamic actors,
articulated objects, or manipulation.

The Husky base is kinematic. The demonstration checks world generation,
sensing, localization, obstacle avoidance, perception, planning, and mission
integration. It does not claim motor, tire, traction, or skid-steer dynamics
fidelity.

!!! note "Read the engineering docs"

    Start with the repository [README](https://github.com/EthanMBoos/Worldfile#readme),
    then see the [world-generation pipeline](https://github.com/EthanMBoos/Worldfile/blob/main/worldfile/README.md),
    [simulation architecture](https://github.com/EthanMBoos/Worldfile/blob/main/docs/sim-architecture.md),
    [research direction](https://github.com/EthanMBoos/Worldfile/blob/main/docs/research.md),
    and [installation guide](https://github.com/EthanMBoos/Worldfile/blob/main/docs/install.md).
