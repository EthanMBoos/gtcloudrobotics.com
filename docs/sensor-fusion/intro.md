---
icon: lucide/book-open
---

# Sensor Fusion

A mobile robot needs an estimate of its own state (e.g., its position and
heading) in order to navigate, but no single sensor provides that estimate
reliably. Each sensor is noisy, measures only part of the state, and reports at
its own rate with its own delay. Sensor fusion is the problem of combining these
measurements into a single estimate that is more accurate than any one sensor
provides on its own.

This page develops the main ideas in order, using a robot driving on flat ground
as the running example. We start with the error in a single measurement, then
show how a filter combines a motion model with measurements, and finally examine
three practical concerns that determine how well this works on a real robot:
coordinate frames, measurement timing, and vehicle speed. Each figure is
interactive and can be rotated by dragging.

## Noise and bias

Every measurement contains error, and it is useful to separate that error into
two parts. Noise is the part that changes randomly from one measurement to the
next, while bias is the part that stays the same. To illustrate the difference,
the figure below shows a lidar repeatedly measuring the range and bearing to a
single post.

<figure class="fig" data-figure="noise">
  <figcaption>Each red dot is one lidar return. The surface shows where the returns have accumulated, and the blue marker is their mean.</figcaption>
</figure>

Because noise is random, it averages out: as more returns accumulate, their mean
converges to the true position of the post, even when the individual returns are
widely scattered. Bias does not average out. Adding a range bias shifts every
return by the same amount, so the mean converges to the wrong position no matter
how many returns are collected. For this reason, bias must be either calibrated
out or estimated, whereas noise can be reduced by combining measurements.

The figure also shows that the shape of the error depends on the sensor. Range
noise spreads the returns along the line of sight, while bearing noise spreads
them sideways by an amount that grows with distance, so the resulting
distribution is generally elongated rather than circular.

## Predict and update

Since no measurement is exact, an estimator should not represent the robot's
position as a single point. Instead, it maintains a belief: a probability
distribution over where the robot could be, which we summarize by a mean (the
best guess) and a covariance (the spread). A filter modifies this belief with
two operations. The prediction step applies the robot's motion to the belief,
and because the motion itself is uncertain, this step increases the spread. The
update step incorporates a measurement, which decreases it.

<figure class="fig" data-figure="fuse">
  <figcaption>The height of each surface is probability density, so a tall, narrow surface is a confident belief. The ellipses mark two standard deviations.</figcaption>
</figure>

The update step is a weighted average of the predicted belief and the
measurement, in which each is weighted by how certain it is. The weight given to
the measurement is called the Kalman gain. When the sensor is noisy relative to
the belief, the gain is small and the belief moves only slightly toward the
measurement; when the sensor is accurate, the gain approaches one. Pressing
**move** several times without measuring shows the other half of the cycle:
without measurements, the spread grows with every step.

## Drift and fixes

We now apply this cycle to a robot driving a closed path. The prediction step
uses odometry, which integrates the measured speed and turn rate to track the
pose. Because odometry integrates its inputs, any bias in them accumulates over
time. In the figure below, a gyro bias of 1 °/s, which is small enough to be
difficult to see in any single reading, produces a position error of about two
meters after one lap. We refer to this accumulated error as drift.

<figure class="fig" data-figure="drift">
  <figcaption>Brown is the pose from odometry alone, and blue is the filter. The ellipse is three standard deviations of the filter's own position uncertainty.</figcaption>
</figure>

The update step uses fixes, which are range and bearing measurements to
landmarks at known positions. Unlike odometry, the error in a fix does not
depend on how far the robot has traveled, so fixes bound the drift that odometry
accumulates. With fixes disabled, the filter drifts exactly as odometry does,
although its covariance ellipse grows to reflect the increasing uncertainty.

Note that this filter does not estimate the gyro bias. It remains accurate only
because fixes arrive frequently enough to correct the drift before it becomes
large, and lowering the fix rate shows how quickly the error increases when they
do not.

## Bearings and ranges

The previous section treated a fix as a single correction, but different sensors
constrain the robot's position in different ways. A range measurement specifies
the distance to a landmark but not its direction, while a bearing measurement
specifies the direction but not the distance. Neither is sufficient on its own
to determine a position. The figure below shows the set of positions that are
consistent with each type of measurement.

<figure class="fig" data-figure="bearing-range">
  <figcaption>The height of the surface is how well each position agrees with the enabled measurements. The bearing measurement assumes that the robot's heading is known.</figcaption>
</figure>

A single range constrains the robot to a ring around the landmark, and a single
bearing constrains it to a wedge whose width grows with distance. The position
is determined only where constraints intersect, which can be achieved either by
combining a range and a bearing to the same landmark or by measuring a second
landmark. This is the main reason to fuse different sensors: each one constrains
the directions that the others leave uncertain.

## Frames

The sections above assumed that all quantities are expressed in the same
coordinate frame. In practice, each sensor reports measurements in its own frame
(e.g., a camera reports points relative to its lens), and these must be
transformed into a common frame before they can be fused. A point therefore has
different coordinates in each frame, and the transforms between frames depend on
both the robot's pose and how each sensor is mounted.

<figure class="fig" data-figure="frames">
  <figcaption>Red, green, and blue are the x, y, and z axes. The world and body frames use x forward, y left, z up. The camera frame uses z forward, x right, y down.</figcaption>
</figure>

The figure shows one point expressed in three frames. Changing the yaw of the
drone leaves the world coordinates of the point unchanged, but changes its
coordinates in the body and camera frames. Changing the camera tilt affects only
the camera coordinates, because the camera frame is defined relative to the
body. The pixel location follows from the camera coordinates by dividing x and y
by the depth z, and it is undefined when the point lies outside the camera's
field of view. An error in any of these transforms (e.g., an incorrect mounting
angle) appears to the filter as a measurement bias.

## Late measurements

Measurements also differ in time. A measurement describes the state of the robot
at the moment the sensor captured it, but it reaches the filter only after some
latency (e.g., exposure, processing, and transport). During that interval the
robot continues to move.

<figure class="fig" data-figure="latency">
  <figcaption>The red marker is the most recent fix at the moment it arrives, which is where the robot was when the fix was captured.</figcaption>
</figure>

If the filter treats a delayed fix as a measurement of the current position,
each update pulls the estimate back toward where the robot was. The resulting
error is approximately the product of speed and latency: at 3 m/s with 250 ms of
latency, the estimate trails the robot by 75 cm. The correction is to use the
capture timestamp. With this option enabled, the filter advances each fix by the
distance that odometry reports the robot traveled since capture, which removes
the lag.

## Speed

Finally, we consider the speed of the robot itself. Sensor rates are fixed in
time rather than in distance, so driving the same path at a higher speed reduces
the number of fixes per meter traveled. Between consecutive fixes the filter
relies on odometry alone, and at higher speeds the robot covers more distance
over which drift can accumulate.

<figure class="fig" data-figure="speed">
  <figcaption>Each red dot marks where a fix was received. The curve is the RMS error of the filter over one lap at each speed, averaged over three random seeds.</figcaption>
</figure>

As a result, the estimation error grows with speed even though the path, the
sensors, and the filter are unchanged. Increasing the camera rate recovers part
of the accuracy, since it restores the density of fixes along the path.

## Running an experiment

[isaacdrones](../isaacdrones.md) is the repo we use for sensor fusion
experiments. It is a small drone simulation base on NVIDIA Isaac Sim, and it
currently renders one camera frame of a cube on a ground plane:

```sh
uv run isaacdrones --headless --camera out.png
```

It has no drone and no IMU yet. Adding them, and passing the simulated sensor
data over ROS 2 to an estimator of the kind on this page, is the first piece of
work in the sensor fusion area.
