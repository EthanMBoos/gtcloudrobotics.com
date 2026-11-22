---
icon: lucide/plane
hide:
- toc
---

# isaacdrones

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/isaacdrones){ .md-button }

**isaacdrones** is a small base for simulating a drone's sensors in
[NVIDIA Isaac Sim](https://docs.isaacsim.omniverse.nvidia.com/latest/) 6.2. It
flies a rigid-body drone along a scripted path, renders an RTX camera mounted on
it, and publishes the images and the drone's true pose over ROS 2. The drone can
fly at a cube, through NVIDIA's warehouse, or over the Georgia Tech campus in
Google's 3D tiles. Isaac Sim requires an NVIDIA RTX GPU, which for this course
means running on PACE ICE.

```sh
uv run isaacdrones --headless --ros --scene warehouse
```

The goal of this track is a set of simulated sensors realistic enough to develop
an estimator against. A simulator suits this because it knows the true state of
the drone at every step, so each sensor, and each piece of software that reads
one, can be checked against the truth.

The camera comes first, because it is the only sensor so far. We give it the
properties of a real one (e.g., lens distortion, noise, and motion blur) and add
a depth output. The sensors that are missing follow: an IMU, a lidar, and an
altimeter. With those in place, we build the software a real drone would run on
them in ROS 2 (e.g., tag detection, visual odometry, and an estimator that fuses
the camera with the IMU), and compare what it reports with what was true.

!!! note "Docs"

    The [README](https://github.com/EthanMBoos/isaacdrones#readme) covers
    everything else. Start with
    [PACE.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/PACE.md)
    for running on the cluster and
    [TODO.md](https://github.com/EthanMBoos/isaacdrones/blob/main/docs/TODO.md)
    for open work.
