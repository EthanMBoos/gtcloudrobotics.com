---
icon: lucide/radar
hide:
- toc
---

# Fusion in Motion

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/fusion-in-motion){ .md-button }

**Fusion in Motion** runs repeatable sensor-fusion experiments on a moving robot
and opens the results in Rerun. There's one working example: a planar ground
robot with an IMU, a camera, and a lidar, and a small EKF as the baseline.

Change the robot's speed or the sensor setup, rerun the same motion, and see
where the estimate starts to degrade.

```text
scenario YAML -> continuous truth -> timed camera, lidar, and IMU
                       |                         |
                       +-> hidden truth          +-> visible measurements
                                                          |
                                                          v
                                                   baseline estimator
                                                          |
                                                          v
                                          metrics and Rerun dashboard
```

## Run it

```sh
fusion run examples/initial.yaml --output runs/initial --view
fusion run examples/with_radar.yaml --output runs/with-radar --view  # adds radar
```

This generates the truth and sensor data, runs the EKF on it, scores the
estimate, and opens Rerun. Each run is saved as a folder with the measurements,
truth, and estimates in MCAP files, plus the scenario and metrics. The estimator
never sees the truth.

## Change motion and sensors

The scenario YAML holds the trajectory, landmarks, random seed, sensor rates,
latency, field of view, range, noise, missed detections, and IMU bias.
`motion_speed_factor` drives the same path faster, so the estimator gets fewer
measurements along it.

```sh
fusion sweep examples/speed_sensor_sweep.yaml --output runs/speed-sensor-sweep
```

A sweep runs several settings over several seeds and writes CSV, JSON, and
Markdown reports. The example compares platform speed against camera rate.

## Bring your own estimator

It doesn't have to be Rust. Read `measurements.mcap`, write timestamped planar
estimates to a CSV, and score them against the same truth:

```sh
fusion score runs/initial my-estimates.csv --id my-filter
```

## Limits

It's planar. Landmark associations are given, motion is analytic, and there are
no vehicle dynamics. Sensors produce bearings and ranges, not raw images or
point clouds.

Latency is a configured number. Nothing measures threads, queues, or
serialization yet. Replaying raw-sized payloads through real worker threads is
planned.

!!! note "Docs"

    [README](https://github.com/EthanMBoos/fusion-in-motion#readme),
    [install](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/INSTALL.md),
    [experiments](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/EXPERIMENTS.md),
    [estimators](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/ESTIMATORS.md),
    and
    [sensor pipelines](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/SENSOR_PIPELINES.md).
