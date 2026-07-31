---
icon: lucide/layers
hide:
- toc
---

# SPAR - Sim Portable Autonomy Runtime

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/spar){ .md-button }

**SPAR** is a small MuJoCo and ROS 2 stack for experimenting with mobile robot autonomy. It gives students a working system they can read, modify, and demonstrate without first building an entire simulator or autonomy stack.

The repository currently contains a Husky ground robot using Nav2, a Skydio X2 drone using PX4 SITL, and a small C++ behavior tree for each. Both robots run in the same MuJoCo world and share a simple camera-to-detection interface.

The working behavior is intentionally basic:

- patrol while a mission is active;
- inspect a red anomaly seen by the camera;
- return home when the battery is low;
- resume after recharging.

This is enough machinery to expose useful seams for course projects without trying to be a general robotics framework.

## Simulation architecture

MuJoCo is the simulator. One Python process owns both robots, the physics state, rendering, sensors, and simulation clock.

```text
                    MuJoCo: one world, one clock
                 /                                \
              HUSKY                                X2
    camera · lidar · noisy GPS          camera · IMU · mag · baro · GPS
                 |                                |
          ROS 2 · Nav2                     ROS 2 · PX4 EKF2
                 |                                |
      ground behavior tree                 air behavior tree
```

The simulator publishes hardware-shaped sensor messages rather than handing the autonomy code a privileged world model. The ground stack navigates with a live lidar scan and a noisy GPS-derived map transform. The air stack sends simulated sensor data through PX4's estimator and accepts PX4 actuator commands back into the physics loop.

The same world can run headless for tests, through a read-only viewer for inspection, or eventually inside a fast training loop without ROS.

## Why MJCF

Each SPAR environment is an [MJCF](https://mujoco.readthedocs.io/en/stable/modeling.html) file under `sim/worlds/`. MJCF is MuJoCo's native, XML-based modeling language. It describes the bodies, joints, geometry, mass, friction, actuators, sensors, cameras, lights, and materials that MuJoCo compiles into a simulation.

The important part for SPAR is that the world is physics-first. There is not a visual scene in one format and a separate physics scene that has to stay synchronized with it. The MJCF file is loaded directly by MuJoCo and becomes the model that the simulator steps.

MJCF can start with a few readable primitives and grow into a detailed scene. A simple box can remain the collision shape while a textured mesh supplies its appearance:

```xml
<mujoco model="depot">
  <asset>
    <texture name="rack_texture" type="2d" file="rack.png"/>
    <material name="rack_material" texture="rack_texture"/>
    <mesh name="rack_mesh" file="rack.obj"/>
  </asset>

  <worldbody>
    <geom name="rack_collision" type="box"
          size="0.8 0.3 0.6" pos="4 1.5 0.6"
          group="3" rgba="0 0 0 0"/>
    <geom name="rack_visual" type="mesh"
          mesh="rack_mesh" material="rack_material"
          pos="4 1.5 0.6" group="2"
          contype="0" conaffinity="0"/>
  </worldbody>

  <include file="../robots/husky.xml"/>
  <include file="../robots/x2.xml"/>
</mujoco>
```

The mesh can carry the detail and texture produced in Blender while the box gives the physics solver and lidar a cheap, predictable surface. Visual fidelity can improve without quietly changing contact behavior.

That combination fits this project better than making a game engine or a general scene-interchange format the runtime authority. URDF is useful for describing a robot, but MJCF comfortably describes the robot and the dynamic world around it. Blender is still useful for authoring assets, but its output is reduced to meshes, materials, and explicit collision geometry before simulation. The final artifact remains plain text that can be generated, reviewed, versioned, and reproduced.

Robot models are composed with the site at load time, so a world describes a place rather than containing a copy of a particular robot. The same MJCF artifact loads in the interactive viewer, the ROS-backed simulator, and the planned training loop without a scene-conversion step between them.

## Why generate worlds

Robot autonomy is often tested against a relatively small collection of hand-built environments. Those environments take time to produce, and they tend to contain the situations their authors already thought to include. Field data expands that set only after a robot encounters something new, often after deployment.

SPAR is exploring whether compositional generation can produce useful variations and targeted edge cases before the robot meets them in the field. The claim is not that a generated world is automatically realistic or useful. The question is whether generation can expose distinct failures that simple domain randomization and a small hand-authored test suite do not.

There are two authoring paths with the same MJCF output:

```text
description
    |
    +-- primitive: model plan -> Python geometry --+
    |                                              |
    +-- fidelity: orchestrator -> BlenderMCP ------+
                                                   |
                                                   v
                                             MJCF world
                                                   |
                                                   v
                                        behavior or policy
                                                   |
                           next description <--- failure
```

The primitive path exists today. A local model chooses coarse scene content, such as props, regions, colors, and orientation. Python owns exact dimensions, coordinates, collision geometry, and seeded variation. The result is a small, inexpensive world that is useful as a baseline and for experiments that need many variations.

The higher-fidelity path is planned. An orchestrator will ask a designer to build and revise the site through BlenderMCP while a critic inspects scene data and rendered views. Blender provides the richer meshes, materials, lighting, and asset workflow; the result still has to reduce to an MJCF site with explicit collision geometry before MuJoCo runs it.

The point is not simply to produce better screenshots. The research question is whether an iterative, tool-using process can repeatedly produce worlds that are visually coherent, physically valid, reproducible, useful for a robot task, and reasonably cheap to generate. Primitive worlds and ordinary domain randomization remain the controls for deciding whether added fidelity actually matters.

A generated world becomes useful when a behavior fails in it for an understandable reason. That failure can drive another description or mutation, followed by another run and eventually evaluation on held-out worlds. The useful output is therefore not the number of scenes produced. It is the number of distinct, task-relevant failures found, whether hardening against them transfers to held-out environments, and what that process costs compared with simpler generation.

## Autonomy as the evaluation harness

SPAR's autonomy stack gives the generated worlds something concrete to test. The existing behavior trees, Nav2 planner, PX4 controller, and color-based detector provide understandable baselines. A learned component can later replace one part at a time without also replacing the mission logic, simulator, or evaluation setup.

A vision model can replace the detector while continuing to publish the same `Detection` message. A learned controller can run inside a behavior-tree leaf and remain subject to the same mission, battery, preemption, and stale-input rules as a hand-written behavior.

The first planned comparison is a learned local planner against Nav2 on the same worlds and start-goal pairs. Success rate, collisions, stale-input behavior, and performance on held-out worlds matter more than whether a policy succeeds in one demonstration.

There is not yet a training environment, exported policy, or learned ROS node in the repository. Building that complete comparison is the next learning milestone.

!!! tip "Read the working design"

    See the repo's [world-generation design](https://github.com/EthanMBoos/spar/blob/main/docs/worldgen.md), [research questions](https://github.com/EthanMBoos/spar/blob/main/docs/research.md), [simulation architecture](https://github.com/EthanMBoos/spar/blob/main/docs/sim-architecture.md), and [RL plan](https://github.com/EthanMBoos/spar/blob/main/docs/rl.md).
