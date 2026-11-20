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
starts in under 10 s, steps physics at a fixed 60 Hz, and renders an RTX camera.
The only scene is a cube on a ground plane, and there is no drone yet. Isaac Sim
requires an NVIDIA RTX GPU, which for this course means running on PACE ICE.

```sh
uv run isaacdrones --headless --camera out.png
```

The goal of this track is a simulated drone whose camera and other sensors are
realistic enough to develop autonomy against. Since the physics loop and the
camera already work, the work begins with the vehicle: a rigid body that
receives a thrust and a torque at each physics step, without a rotor model.

A camera is then mounted on that body, with the near clipping distance set well
below the 1 m default of Isaac Sim, because a drone camera operates close to
surfaces. The steps after that depend on the demo, and include the ROS 2 bridge,
RTX lidar or radar, and a flight stack.

!!! note "Docs"

    The [README](https://github.com/EthanMBoos/isaacdrones#readme) covers
    everything else. Start with
    [PACE.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/PACE.md)
    for running on the cluster and
    [TODO.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/TODO.md)
    for open work.
