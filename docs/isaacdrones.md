---
icon: lucide/plane
hide:
- toc
---

# isaacdrones

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/isaacdrones){ .md-button }

**isaacdrones** is a small base for simulating aerial drones in
[NVIDIA Isaac Sim](https://docs.isaacsim.omniverse.nvidia.com/latest/) 6.2. It
starts Isaac Sim in under 10 s, advances physics by a fixed timestep, and
renders an RTX camera. The only scene is a cube on a ground plane, at rest or
falling. No drone is modeled yet.

```sh
uv run isaacdrones                              # a window and a ground plane
uv run isaacdrones --headless --steps 100       # no window, 100 frames
uv run isaacdrones --headless --camera out.png  # one image of the cube
uv run isaacdrones --headless --video DIR       # the cube falling, 120 frames
```

Each frame is one physics step at 60 Hz. On exit the program prints the frame
count, the simulation time, and the physics engine.

## The first work

Start with a rigid body that takes thrust and torque at each physics step,
before any rotor model. Then put a camera on it. A camera on a drone passes
close to objects, so it needs a near clip below Isaac Sim's default of 1 m.

After that, pick what your demo needs: the ROS 2 bridge with an RTX sensor in
the loop, RTX lidar or radar, pacing to real time, or a flight stack. A flight
stack or a specific vehicle will also settle body frames, camera axes, and
joint order, which are open today.

## How the code is laid out

The project builds directly on Isaac Sim, not Isaac Lab. Only
`src/isaacdrones/sim/` imports Isaac Sim, and it exposes one class,
`Simulation`, that owns the app, the stage, and the loop. The rest of the
package imports on any machine, and a test enforces that.

All stepping goes through `Simulation`, and logic reads simulation time, not
the wall clock. Quaternions are `wxyz`, units are meters and radians, and Z is
up.

## Current limits

Isaac Sim needs Linux or Windows 11 on x86_64 and an NVIDIA RTX GPU. macOS
cannot run the simulator, though the package installs there and the tests that
need no simulator run. Our only machine that runs it is Georgia Tech's PACE ICE
cluster, so code that touches the simulator is unverified until it has run
there.

`--video` and `--stream` are currently unverified. RTX lidar and radar are
untried.

!!! note "Read the engineering docs"

    Start with the repository
    [README](https://github.com/EthanMBoos/isaacdrones#readme).
    [TODO.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/TODO.md)
    lists open work,
    [PACE.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/PACE.md)
    covers running on the cluster and what was verified there, and the [Isaac
    Sim
    notes](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/reference/ISAAC_SIM_NOTES.md)
    give the reasons behind the design.
