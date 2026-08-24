---
icon: lucide/radar
hide:
- toc
---

# Fusion in Motion

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/fusion-in-motion){ .md-button }

**Fusion in Motion** runs deterministic moving sensor-fusion experiments and
opens the results in an animated Rerun dashboard. The repository has one
complete initial example: a planar ground robot observed by an IMU, a camera,
and a lidar.

A state-estimation engineer can change the platform speed or sensor
configuration, run the same motion again, and see where the estimate begins to
degrade. A small extended Kalman filter provides the baseline estimate.

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

## The initial experiment

The ground robot accelerates, follows straight and turning segments, and
decelerates through a sparse landmark map. The IMU reports angular rate and
specific force. The camera reports associated landmark bearings, while the
lidar reports associated range and bearing returns over timed scans.

```sh
fusion run examples/initial.yaml --output runs/initial --view
```

The command generates the truth and sensor stream, replays the persisted
measurements through the baseline EKF, scores the estimate, and opens Rerun.
The dashboard loops the experiment with a truth-versus-estimate map, separate
ego-centric camera and lidar views, estimation error, IMU data, and observation
counts.

Every run is saved as a self-contained experiment bundle. The estimator-visible
measurements, hidden truth, and estimates use Protobuf messages in MCAP files.
The run also contains the resolved scenario, artifact hashes, readable metrics,
and the Rerun recording. The estimator never receives the hidden truth stream;
it is opened afterward for scoring and visualization.

The optional radar example adds a fourth sensor:

```sh
fusion run examples/with_radar.yaml --output runs/with-radar --view
```

That scenario adds analytic range, bearing, and radial-velocity detections to
the same motion and evaluation path.

## Change motion and sensors

Scenario YAML keeps the variables that define an experiment in one place. It
includes the trajectory, landmarks, random seed, sensor rates, latency, field
of view, range, noise, missed detections, IMU bias and saturation, and the
measurement uncertainty assumed by the estimator.

`motion_speed_factor` changes how quickly the robot traverses the configured
path without changing the path geometry. Sensor rates remain samples per
second, so a faster traversal gives the estimator fewer observations along the
same path. This makes speed-versus-sensor-rate experiments straightforward to
interpret.

A sweep applies several values to the same base scenario and repeats each case
for the requested seeds:

```sh
fusion sweep examples/speed_sensor_sweep.yaml --output runs/speed-sensor-sweep
```

The sweep example compares platform speed and camera rate. Each case remains a
normal experiment bundle, while aggregate CSV, JSON, and Markdown reports place
the scenario parameters beside position error, yaw error, availability,
divergence, and other baseline metrics. Named random streams keep paired cases
comparable when one sensor setting changes.

## One measurement log, different estimators

The bundled EKF propagates a planar state from the IMU and applies camera,
lidar, and optional radar updates in causal delivery order. The Rust source
names frames, units, state elements, covariance, and matrix operations
explicitly.

Another estimator does not need to be rewritten in Rust. It can read
`measurements.mcap` in its own environment, export timestamped planar
estimates as CSV, and use the same truth and metrics:

```sh
fusion score runs/initial my-estimates.csv --id my-filter
```

Several estimators can reuse the same saved measurements without receiving the
truth used to judge them.

## Toward high-throughput sensor pipelines

The current camera, lidar, and radar models produce lightweight analytic
observations. They do not create raw images, dense point clouds, or raw radar
data, and they do not yet place those payloads into competing runtime queues.
Configured sensor latency changes causal arrival time but does not measure
thread scheduling, serialization, memory pressure, or blocked workers.

The planned runtime experiments hold the deterministic sensor workload fixed
while replaying it through a shared queue, a worker pool, isolated sensor
workers, or separate perception frontends feeding one ordered fusion stage.
Synthetic payload buffers provide realistic byte volume without requiring a
complete renderer.

That comparison connects runtime behavior to estimation behavior:

```text
pipeline architecture
        -> queue delay, message age, and dropped data
        -> estimator accuracy and availability
```

The deterministic simulator can explore queue capacity, bandwidth, processing
cost, and dropping policy quickly. A separate multithreaded replay can then
measure the operating-system and hardware effects that a simulated queue cannot
predict. Keeping those modes separate avoids mistaking a repeatable workload
model for a hardware benchmark.

## Current limits

Fusion in Motion is presently a planar, measurement-level playground. Its
landmark associations are supplied, its motion is analytic, and its baseline
does not represent production perception or a physical sensor validation. It
does not simulate vehicle dynamics or render raw sensor data. High-throughput
transport benchmarks are not yet implemented.

The current version covers repeatable scenarios, timed measurements,
estimation, scoring, saved artifacts, sweeps, and visualization. Raw payloads,
frontends, and runtime experiments are not yet implemented.

!!! note "Read the engineering docs"

    Start with the repository [README](https://github.com/EthanMBoos/fusion-in-motion#readme)
    and [installation guide](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/INSTALL.md).
    The [experiment guide](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/EXPERIMENTS.md)
    covers scenarios, sweeps, and run folders; the
    [estimator guide](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/ESTIMATORS.md)
    explains how to score another implementation; and
    [sensor pipelines](https://github.com/EthanMBoos/fusion-in-motion/blob/main/docs/SENSOR_PIPELINES.md)
    describes the planned runtime experiments.
