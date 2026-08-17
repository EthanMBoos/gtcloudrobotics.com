---
icon: lucide/layers
hide:
- toc
---

# Worldfile

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/Worldfile){ .md-button }

**Worldfile** turns LLM-authored 3D environments into MuJoCo world files that can be loaded and tested without Blender. It keeps the open-ended scene decisions inside a bounded authoring process and leaves the exact physics and export work to code.

A build starts with an environment family, a seed, and a short brief. The LLM works through a fixed set of stages in Blender to choose the layout, objects, contextual details, and appearance. Repository code then compiles the accepted scene into MJCF and checks whether it is usable.

Worldfile is not another simulation format or a simulation platform. The current target is ordinary MJCF with its referenced assets. Blender is the current authoring tool, but the compiled world does not need Blender at runtime.

## Author, compile, validate

```text
environment family + seed + brief
                |
                v
       bounded LLM authoring
                |
                v
          Blender scene
                |
                v
       deterministic compiler
                |
                v
        MJCF + referenced assets
                |
                v
             validation
```

The Blender scene is an authoring artifact. The compiled MuJoCo model is the result.

The LLM handles choices that are awkward to enumerate in procedural code: composition, layout, object selection, local detail, and appearance. The compiler owns the parts that need to be exact: coordinate conversion, asset paths, visual and collision geometry, physical properties, semantic names, robot spawns, sensors, and task sites.

That division matters because a scene that looks plausible is not necessarily a working robot environment. The compiler fails the build when the MJCF does not compile, assets are missing, bodies remain unstable, collisions are invalid, or the required spawn, route, and task sites do not check out.

Generated worlds keep detailed visual meshes separate from simpler collision geometry. They also carry named sites for the robot spawn, dock, perception target, and navigation goals. The result is a small set of files that MuJoCo and robot software can consume directly.

## The current world family

The working environment family is an outdoor utility depot. A seed and brief vary the site layout while the family recipe keeps the result inside a form the compiler and validator understand. The committed example includes static buildings, storage areas, roads, barriers, vegetation, a Husky route, a dock, and a red barrel used as the perception target.

The current family is deliberately narrow. It covers static geometry, a mobile robot, perception targets, navigation goals, and a complete ROS mission. Dynamic actors, articulated objects, and manipulation are later extensions of the same authoring and compilation boundary; they are not part of the current result.

MuJoCo is the first simulation target and Blender is the first authoring tool. Other tools only make sense when they solve a concrete problem better.

## A robot has to use the world

The Husky autonomy stack is the evaluation harness for the generated world. MuJoCo produces wheel encoder, IMU, GPS, lidar, and RGB-D camera data. ROS 2 localizes the robot, detects the red barrel, and runs the mission behavior tree. Nav2 plans around the exported collision geometry and sends velocity commands back to MuJoCo.

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

The unattended smoke test runs the complete mission contract. The robot starts idle, begins rounds on command, sees and inspects the red barrel through the RGB-D pipeline, resumes rounds, returns to its dock on low battery, recharges, resumes again, and stops on command.

This test is useful because it crosses the whole generated environment: geometry, collision meshes, robot placement, route clearance, semantic sites, camera visibility, localization, planning, perception, and mission behavior. Passing an XML load check alone would miss most of those failures.

The Husky base is kinematic. This setup tests world generation, sensing, localization, planning, obstacle avoidance, perception, and mission integration. It does not claim motor, tire, traction, or skid-steer dynamics fidelity.

## What the research tests

The research question is what structure and validation an LLM needs to reliably produce a physics-ready robot world.

The planned first comparison holds the environment families, seeds, briefs, and robot task constant across three generation methods: one-shot generation, bounded staged generation, and staged generation with one repair pass. The measurements include unattended build success, generation time and model calls, MJCF load success, missing assets, collision and stability checks, route and task-site validity, perception and navigation completion, and complete mission success.

Repeated builds on held-out seeds and briefs test whether the process is reliable and whether it produces meaningful variation. A second environment family tests whether the authoring contract generalizes beyond the utility depot.

Policy training may eventually use the resulting worlds, but it is not required for the first evaluation. The fixed autonomy stack gives each world a repeatable task now.

!!! tip "Read the working design"

    See the repo's [research direction](https://github.com/EthanMBoos/Worldfile/blob/main/docs/research.md), [compiler guide](https://github.com/EthanMBoos/Worldfile/blob/main/worldfile/README.md), [simulation architecture](https://github.com/EthanMBoos/Worldfile/blob/main/docs/sim-architecture.md), and [installation guide](https://github.com/EthanMBoos/Worldfile/blob/main/docs/install.md).
