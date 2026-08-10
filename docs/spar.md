---
icon: lucide/layers
hide:
- toc
---

# SPAR - Sim Portable Autonomy Runtime

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/SPAR){ .md-button }

**SPAR** is a small MuJoCo and ROS 2 stack for learning mobile robot autonomy. It gives students a working system they can read, change, and demonstrate without first building an entire simulator or autonomy stack.

The repository contains a Husky ground robot using Nav2, a Skydio X2 drone using PX4 SITL, and an XML behavior tree backed by C++ nodes for each. Both robots run in the same MuJoCo world and use the same camera-to-detection interface.

The working behavior is basic:

- patrol while a mission is active;
- inspect a red anomaly seen by the camera;
- return home when the battery is low;
- resume after recharging.

Students choose what they want to build and demonstrate every two weeks. SPAR gives them a working base to start from without trying to be a general robotics framework.

## Simulation architecture

MuJoCo runs headless in a Docker container and owns the world, simulation clock, sensor data, and physical robot poses. Ground ROS runs in one robot container; air ROS and PX4 run together in another. An optional native MuJoCo viewer on the host mirrors the running scene.

```text
GROUND                                      AIR

MuJoCo sensors                              MuJoCo flight sensors
      |                                              |
      v                                              v
ROS localization                              PX4 estimation
      |                                              |
      v                                              v
ROS behavior                                  ROS behavior
      |                                              |
      v                                              v
Nav2 -> cmd_vel -> MuJoCo                PX4 flight control -> MuJoCo
```

SPAR simulates outdoor robots in a small local patch of Earth. Every world records the latitude, longitude, and altitude of its origin, called the world datum. MuJoCo and the ROS `map` frame use the same east-north-up coordinates in metres from that point.

The world MJCF stores geometry, the datum, and both physical robot spawns. Matching ground and air YAML files store the same datum, homes, and waypoints. MuJoCo turns robot motion into sensor data, including noisy GPS.

The Husky uses simulated wheel encoders, IMU, GPS, camera, and lidar. ROS localizes it, the behavior tree chooses a target, and Nav2 plans around obstacles. For fast behavior testing, the simulator moves the Husky directly from Nav2's `cmd_vel`; SPAR does not model its motors or tire physics.

The X2 sends simulated GPS, IMU, magnetometer, and barometer data through PX4's estimator. ROS chooses a target in the shared east-north-up `map`, converts it to PX4's local north-east-down frame, and lets PX4 stabilize and fly the drone. The current air demo follows explicit targets and does not avoid obstacles.

## Why MJCF

Each runnable environment is an [MJCF](https://mujoco.readthedocs.io/en/stable/modeling.html) file under `sim/worlds/`. MJCF is MuJoCo's XML format for the world, robots, geometry, physics, cameras, lights, and materials.

Generated worlds keep detailed visual meshes separate from collision meshes. They also carry named sites for spawns, homes, inspection targets, and waypoints. The exporter attaches the pose-neutral Husky and X2 models at the authored spawn frames.

The same MJCF world loads in the native viewer and the ROS-backed simulator. The committed world does not need Blender at runtime.

## Why generate worlds

Hand-built test environments take time and usually contain only the cases their authors thought to add. SPAR uses an LLM and BlenderMCP to build new worlds from a bounded family recipe, then exports and checks them before autonomy runs.

```text
WORLD + SEED + BRIEF
         |
         v
recorded family recipe
         |
         v
16 LLM-to-BlenderMCP calls in one visible Blender scene
plan -> build -> detail/materials -> render -> ground/air waypoints
         |
         v
deterministic export
         |
         v
MJCF + visual/collision assets + ground/air YAML
         |
         v
validated MuJoCo world and robot routes
```

`WORLD` names the output. `SEED` controls repeatable choices owned by the repository, including default spawn and home poses. `BRIEF` supplies a supported override, such as a denser storage area or a requested robot placement. The recipe, prompts, and stage traces are recorded with the generated artifacts.

The exporter writes visual and collision meshes, semantic sites, robot spawns, the world datum, homes, and waypoints. Validation checks the MJCF and its assets, robot placement, ground waypoint clearance and anomaly visibility, and air-route clearance. The complete command runs without manual approval between stages.

`utility_depot_40_v2` is the committed working showcase. It includes the MJCF, visual and collision assets, export manifest, and matching ground and air world configurations.

## Autonomy as the evaluation harness

SPAR's autonomy gives each generated world something concrete to test. Ground waypoints become Nav2 goals. Air waypoints become explicit 3D targets sent through PX4. Both behavior trees consume the same camera-to-map `Detection` message from the red-object detector.

The unattended ground and air checks exercise patrol, inspection, low-battery return, docking or landing, and mission resume against the selected world.

!!! tip "Read the working design"

    See the repo's [world-generation guide](https://github.com/EthanMBoos/SPAR/blob/main/worldgen/README.md), [simulation architecture](https://github.com/EthanMBoos/SPAR/blob/main/docs/sim-architecture.md), [autonomy architecture](https://github.com/EthanMBoos/SPAR/blob/main/docs/autonomy-architecture.md), and [installation guide](https://github.com/EthanMBoos/SPAR/blob/main/docs/install.md).
