---
icon: lucide/radar
hide:
- toc
---

# Fusion in Motion

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/fusion-in-motion){ .md-button }

**Fusion in Motion** generates, replays, and compares moving sensor-fusion
experiments. One scenario defines the vehicle trajectory, world, mounted
sensors, timing, faults, and random seeds. The resulting measurements can drive
a causal filter, fixed-lag estimator, or offline smoother without changing the
rest of the experiment.

The same contracts cover ground robots, multirotors, and external sensor front
ends written in Rust, Python, or C++. The useful result is a controlled
comparison, not one favored estimator or polished robot demo.

```text
scenario + seed set
        |
        v
continuous vehicle and world truth
        |
        v
timed sensor acquisition + faults
        |
        v
estimator-visible measurement stream
        |
        +--> causal filter
        +--> fixed-lag estimator
        +--> offline smoother
        |
        v
truth-aware metrics and report
```

## One experiment, separate records

A Rust core owns continuous truth, metric geometry, mounted sensor frames, the
event clock, analytic sensor models, fault injection, and deterministic logging.
A scenario can change the platform, trajectory, sensor count, rates, mounting
transforms, clocks, noise, and availability without changing an estimator.

Each run writes a resolved scenario and manifest, estimator-visible
`measurements.mcap`, hidden `truth.mcap`, one estimate log per algorithm, and a
saved report. True acquisition times, ideal observations, fault magnitudes,
clock mappings, and oracle associations stay in the truth log. Several
estimators can therefore reuse one measurement log without gaining access to
the answers used for scoring.

MCAP carries Protobuf messages with generated Rust, Python, and C++ readers.
The manifest records the scenario, software, random generator, estimator and
metric settings, assets, and hashes. Rerun and saved plots remain derived views.

## Motion, time, and sensor failures

All vehicles and mounts use one SE(3) truth model. A differential-drive robot
constrains its trajectory to planar motion; a multirotor uses the full
three-dimensional state. Both share the same frames, timestamps, messages, and
scoring code.

The scheduler delivers sensor events instead of advancing everything at one
global rate. Measurements distinguish acquisition, the reported device clock,
publication, and estimator arrival. Rolling sensors can also carry per-element
acquisition times.

Clock drift, latency, batching, reordering, and out-of-sequence arrival are
ordinary experiment settings. So are bias, correlation, saturation,
quantization, occlusion, slip, multipath, dropout, mounting error, and
common-mode disturbance. Random draws are keyed by component, event, and named
effect, so adding one sensor does not change another sensor's existing noise.
Estimator comparisons reuse the same seed set and report paired results.

Inputs are labeled as summary constraints, analytic observations, or raw data
from a log or renderer. A camera bearing is not presented as a rendered image,
and an idealized detection is not presented as raw radar. Association
assumptions remain explicit.

## Ground and aerial experiments

The ground experiment drives a differential robot through starts, stops,
straight segments, turns, and speed changes. Landmarks and surfaces support
camera projection, occlusion, and timed lidar intersection. IMU, wheel ticks,
camera observations, and lidar run under bias, slip, clock offset, delay,
mounting error, and dropout.

The aerial experiment drives a multirotor through hover, vertical motion,
translation, yaw, and roll/pitch excitation. IMU, GNSS, barometer,
magnetometer, rangefinder, optical flow, and UWB use the same contracts under
GNSS outage, magnetic disturbance, and changing visibility.

The trajectory boundary also admits prescribed SE(3), skid-steer, Ackermann,
omnidirectional, uneven-terrain, and fixed-wing profiles. Those models change
how truth is generated and validated; they do not create separate sensor or
evaluation systems.

## Estimators and reports

One small Rust estimator exercises the in-process path. A process protocol lets
Python and C++ systems keep their established perception and optimization
libraries. Each estimator declares its inputs, output state and frame,
uncertainty convention, assumptions, execution class, and front-end boundary.

Causal estimators receive records only when they arrive. Fixed-lag estimators
can revise a declared window; offline estimators can read the complete visible
log and are reported separately. Filters, graphs, smoothers, particle and robust
methods, and learned hybrids keep their native state and execution models.

Reports include absolute and relative trajectory error, drift, initialization,
availability, fault recovery, NIS/NEES, covariance coverage, and residual
checks where supported. Crashes, divergence, timeouts, and missing output stay
in the results. Runtime, memory, machine details, and provenance stay beside
accuracy.

## Project boundary

Fusion in Motion is a sensor-fusion experiment runner, not a general robot
simulator. Physics, rendering, production perception, and live middleware
remain external. Full simulators, ROS 2 bags, and real datasets connect through
explicit truth, sensor, or conversion boundaries.

Metric geometry remains separate from appearance. A mesh or lidar map supplies
range and occlusion truth; a textured asset or Gaussian splat can supply camera
appearance. Synthetic runs verify equations and controlled failures with exact
truth. Imported moving-robot datasets test the same contracts against real
sensing, calibration, synchronization, and imperfect reference trajectories.

This boundary keeps the difficult experimental details visible: motion, time,
frames, calibration, uncertainty, causality, reproducibility, and fair
comparison across ground and aerial vehicles.

!!! note "Read the engineering docs"

    Start with the repository [README](https://github.com/EthanMBoos/fusion-in-motion#readme)
    for the implementation contract, then read the
    [literature and design review](https://github.com/EthanMBoos/fusion-in-motion/blob/main/LITERATURE_REVIEW.md)
    for the estimation foundations, sensor models, software landscape, and
    dataset coverage behind it.
