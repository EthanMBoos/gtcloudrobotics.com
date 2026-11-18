---
icon: lucide/plane
hide:
- toc
---

# isaacdrones

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/isaacdrones){ .md-button }

**isaacdrones** is a small base for simulating drones in
[NVIDIA Isaac Sim](https://docs.isaacsim.omniverse.nvidia.com/latest/) 6.2. It
boots in under 10 s, steps physics at a fixed 60 Hz, and renders an RTX camera.
The only scene is a cube on a ground plane. There's no drone yet.

```sh
uv run isaacdrones                              # a window and a ground plane
uv run isaacdrones --headless --steps 100       # no window, 100 frames
uv run isaacdrones --headless --camera out.png  # one image of the cube
uv run isaacdrones --headless --video DIR       # the cube falling, 120 frames
```

## Where to start

Make a rigid body that takes thrust and torque each physics step. Skip the rotor
model for now. Then put a camera on it and set the near clip well below Isaac
Sim's 1 m default, since a drone camera gets close to things.

After that it depends on your demo: the ROS 2 bridge, RTX lidar or radar, or a
flight stack.

## Code layout

It's built on Isaac Sim directly, not Isaac Lab. Only `src/isaacdrones/sim/`
imports Isaac Sim, through one class, `Simulation`, which owns the loop.
Everything else imports on any machine.

Use simulation time, not the wall clock. Quaternions are `wxyz`, units are
meters and radians, and Z is up.

## Limits

Isaac Sim needs Linux or Windows with an NVIDIA RTX GPU, which for us means PACE
ICE. It won't run on macOS, though the package installs there and the non-sim
tests run.

`--video` and `--stream` haven't been checked recently. Lidar and radar are
untried.

!!! note "Docs"

    [README](https://github.com/EthanMBoos/isaacdrones#readme),
    [TODO.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/TODO.md),
    [PACE.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/PACE.md)
    (running on the cluster), and the design
    [notes](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/reference/ISAAC_SIM_NOTES.md).
