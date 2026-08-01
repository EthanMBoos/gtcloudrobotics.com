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

## Why MJCF

Each runnable SPAR environment is an [MJCF](https://mujoco.readthedocs.io/en/stable/modeling.html) file under `sim/worlds/`. MJCF is MuJoCo's native, XML-based modeling language for bodies, joints, geometry, mass, friction, actuators, sensors, cameras, lights, and materials. MJCF can start with a few readable primitives and grow into a detailed scene. A simple box can remain the collision shape while a textured mesh supplies its appearance:

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

The mesh can carry visual detail and texture while the box gives the physics solver and lidar a cheap, predictable surface. Visual fidelity can improve without quietly changing contact behavior.

That combination fits this project better than making a game engine or a general scene-interchange format the runtime authority. URDF is useful for describing a robot, but MJCF comfortably describes the robot and the dynamic world around it. SPAR keeps detailed visual meshes separate from simple native collision geometry while packaging both, along with materials and semantic sites, in a plain-text runtime artifact that can be reviewed, versioned, and reproduced.

Robot models are composed with the site at load time, so a world describes a place rather than containing a copy of a particular robot. The same MJCF artifact loads in the interactive viewer and the ROS-backed simulator without another scene-conversion step.

## Why generate worlds

Robot autonomy is often tested against a relatively small collection of hand-built environments. Those environments take time to produce, and they tend to contain the situations their authors already thought to include. Field data expands that set only after a robot encounters something new, often after deployment.

SPAR authors generated worlds through [BlenderMCP](https://blendermcp.org/). A language model uses the Model Context Protocol (MCP) to call tools that inspect the current scene, execute Python inside Blender, render views, revise the scene, and save the resulting `.blend` file. The repository supplies the prompts and scene contract, then exports the accepted scene to MuJoCo assets and validates the result.

```text
description
    |
    v
BlenderMCP layout -> detail, render, and bounded repair
    |
    v
accepted .blend -> visual geometry + collision proxies + semantic sites
    |
    v
export -> OBJ/PNG + MJCF + optional ground/air routes
    |
    v
MuJoCo compile and visual inspection -> autonomy run
```

The current recipe uses three BlenderMCP passes. The first creates the complete spatial layout and semantic object labels. The second adds procedural detail, Poly Haven materials and lighting, renders the result, and makes bounded repairs after inspecting those renders. The third inspects the finished scene and places ordered ground and air patrol markers for the behaviors that currently consume explicit routes.

An exportable scene separates detailed render geometry, editable box and cylinder collision proxies, and named semantic sites into explicit Blender collections. The exporter evaluates the visual scene into material-grouped OBJ meshes and PNG textures, turns collision proxies into native MJCF geoms, carries the semantic sites into the world, and composes the Husky and X2 robot models at load time. With world-authored waypoints enabled, it also writes the literal ROS parameter files used by the ground and air behavior trees.

The export checker verifies the 40×40 m site, referenced assets, finite proxy and site transforms, required spawn and dock markers, route files, air-route clearance, and MuJoCo compilation. Human visual inspection remains part of accepting the result.

`utility_depot_40_v1` is the committed working showcase. It includes the generated MJCF, visual assets, export manifest, and matching ground and air waypoint files. The editable Blender scene stays outside the runtime so the committed world can run without Blender or BlenderMCP installed.

## Autonomy as the evaluation harness

SPAR's autonomy stack gives the generated world something concrete to test. The ground route is passed to Nav2 as a sequence of goals. The air route is a sequence of explicit 3D targets flown through PX4; because that behavior does not avoid obstacles dynamically, export rejects a route below the world's collision-clear flight floor.

Both behavior trees consume the same camera-to-map `Detection` message from the color-based anomaly detector. The unattended ground and air checks exercise patrol, inspection, low-battery return, recharge or landing, and mission resume against the selected world.

!!! tip "Read the working design"

    See the repo's [world-generation guide](https://github.com/EthanMBoos/spar/blob/main/docs/worldgen.md), [simulation architecture](https://github.com/EthanMBoos/spar/blob/main/docs/sim-architecture.md), and [installation guide](https://github.com/EthanMBoos/spar/blob/main/docs/install.md).
