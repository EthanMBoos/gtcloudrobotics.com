---
icon: lucide/file-text
---

# Background

This page gives a brief history of sensor fusion for autonomous vehicles and
drones, and then examines six ideas from that history that you are likely to
meet in current code. The timeline covers the full period. The sections below
it concentrate on the more recent points, because the earliest ones (the Kalman
filter and its extensions) are the subject of the [intro page](intro.md). The
figures are small simulations written for this page and are not recordings of
real systems.

<div class="tl">
<div class="tl-item tl-theory"><span class="tl-year">1960</span><span class="tl-name">Kalman filter</span><span class="tl-note">Estimation becomes recursive</span></div>
<div class="tl-item tl-theory"><span class="tl-year">1961</span><span class="tl-name">Extended Kalman filter</span><span class="tl-note">Nonlinear models; flies on Apollo</span></div>
<div class="tl-item tl-theory"><span class="tl-year">1979</span><span class="tl-name"><a href="#association">Multiple hypothesis tracking</a></span><span class="tl-note">Which detection is which object</span></div>
<div class="tl-item tl-theory"><span class="tl-year">1982</span><span class="tl-name">Error-state filter</span><span class="tl-note">The inertial sensor is the motion model</span></div>
<div class="tl-item tl-theory"><span class="tl-year">1986</span><span class="tl-name">Stochastic map</span><span class="tl-note">Robot and landmarks in one estimate</span></div>
<div class="tl-item tl-theory"><span class="tl-year">1997</span><span class="tl-name"><a href="#pose-graph">Pose graph</a></span><span class="tl-note">Keep every pose and solve once</span></div>
<div class="tl-item tl-road"><span class="tl-year">2005</span><span class="tl-name">Stanley</span><span class="tl-note">A fused pose filter crosses the desert</span></div>
<div class="tl-item tl-road"><span class="tl-year">2007</span><span class="tl-name"><a href="#slammot">SLAMMOT</a></span><span class="tl-note">Moving objects join the estimate</span></div>
<div class="tl-item tl-air"><span class="tl-year">2007</span><span class="tl-name"><a href="#visual-inertial">MSCKF</a></span><span class="tl-note">Camera and inertial fusion at low cost</span></div>
<div class="tl-item tl-road"><span class="tl-year">2010</span><span class="tl-name"><a href="#map-localization">Map-based localization</a></span><span class="tl-note">A prior lidar map bounds the error</span></div>
<div class="tl-item tl-theory"><span class="tl-year">2012</span><span class="tl-name"><a href="#factor-graphs">iSAM2 and GTSAM</a></span><span class="tl-note">Smoothing becomes a shared library</span></div>
<div class="tl-item tl-road"><span class="tl-year">2012</span><span class="tl-name">KITTI</span><span class="tl-note">Methods compared on the same data</span></div>
<div class="tl-item tl-air"><span class="tl-year">2014</span><span class="tl-name">Open autopilot EKF</span><span class="tl-note">ArduPilot, then PX4</span></div>
<div class="tl-item tl-air"><span class="tl-year">2023</span><span class="tl-name">Swift</span><span class="tl-note">Learning around a Kalman filter</span></div>
</div>
<div class="tl-key"><span class="tl-theory">shared theory</span><span class="tl-road">road vehicles</span><span class="tl-air">drones</span></div>

## From spacecraft to robots

The first third of the timeline belongs to aerospace. Rudolf Kalman's
[1960 paper](https://doi.org/10.1115/1.3662552) made estimation recursive: the
filter keeps only the current estimate and its uncertainty, and updates both as
each measurement arrives. Stanley Schmidt's group at NASA Ames extended the
method to nonlinear models for the Apollo program by linearizing about the
current estimate, and published it in 1961. The
[1982 review](https://doi.org/10.2514/3.56190) by Lefferts, Markley, and Shuster
describes the arrangement that flight controllers still use, in which the
inertial sensor is integrated as the motion model and the filter estimates the
small error of that integration.

Two further ideas complete the theory that robots inherited. Donald Reid's
[multiple hypothesis tracker](https://doi.org/10.1109/TAC.1979.1102177) (1979)
addressed several objects observed by one sensor. Smith and Cheeseman's
[stochastic map](https://doi.org/10.1177/027836498600500404) (1986) placed the
robot and the landmarks that it observes in a single estimate with a shared
covariance, which is the problem that was named simultaneous localization and
mapping (SLAM) in 1995.

The remaining points are systems. Stanford's
[Stanley](http://robots.stanford.edu/papers/thrun.stanley05.pdf) won the 2005
DARPA Grand Challenge with a 15-state unscented Kalman filter that fused GPS, an
inertial sensor, and wheel encoders. [KITTI](https://doi.org/10.1109/CVPR.2012.6248074)
(2012) provided synchronized camera, lidar, and inertial recordings with ground
truth, so that two methods could be compared on the same data. ArduPilot added a
navigation EKF in [January 2014](https://ardupilot.org/copter/docs/common-history-of-ardupilot.html),
and the same derivation became the default estimator of PX4 in 2016.
[Swift](https://doi.org/10.1038/s41586-023-06419-4) (2023) beat human champions
at drone racing with a learned policy, and inside it a Kalman filter corrects the
drift of the visual-inertial odometry each time a gate is detected.

## Which detection belongs to which track { #association }

A Kalman filter assumes that we know which object produced each measurement.
A sensor that observes several objects (e.g., a radar, or a lidar detector)
does not provide this. It reports unlabelled positions, it misses some objects
in each scan, and some of its detections are false. We refer to the problem of
matching detections to tracks as data association. Reid's tracker kept several
candidate matchings and decided among them with later scans. Most vehicle
trackers today use a simpler method: one Kalman filter per object, a gate that
rejects distant detections, and a single one-to-one assignment per scan (e.g.,
[SORT](https://arxiv.org/abs/1602.00763), and the trackers in Autoware and
Apollo).

<figure class="fig" data-figure="assoc">
<figcaption>Dark drones are the true objects. Red points are the detections of
the latest scan, including false alarms. Each blue circle is the gate of a
track, and each blue line is the path that the track has reported. With
"nearest neighbour", each track in turn takes its closest detection. With
"global assignment", the tracker chooses the pairing with the lowest total
cost. The counter runs both rules on the same detections.</figcaption>
</figure>

With the default settings, global assignment loses its target about half as
often as nearest neighbour (5.7 against 10.8 times in two minutes, averaged over
30 runs). The advantage shrinks as false alarms increase, because most errors
then occur when an object is missed and a false alarm falls inside its gate, and
no assignment rule can detect this within a single scan. This is the reason that
methods which defer the decision, such as Reid's, remain in use.

## Keeping every pose { #pose-graph }

A filter retains only the current pose, so an error made early in a trajectory
cannot be corrected later. Lu and Milios
([1997](https://doi.org/10.1023/A:1008854305733)) instead kept every pose as a
variable and treated each odometry step as a constraint between two consecutive
poses. We refer to this structure as a pose graph. When the robot recognizes a
place that it has visited before, it adds one more constraint between two poses
that are far apart in time, and solving for all of the poses together
distributes the accumulated error along the trajectory. This added constraint is
called a loop closure.

<figure class="fig" data-figure="posegraph">
<figcaption>The dark rover drives one lap of the grey track. Each blue point is
a pose that the robot has kept, joined to the next by an odometry constraint. A
red line is a constraint between two poses that the robot believes to be the
same place. "One false match" adds such a constraint between two poses on
opposite sides of the lap.</figcaption>
</figure>

Without the loop closure, the gyro bias leaves a gap of a metre or more between
the first pose and the last. With it, the gap closes and the error of every pose
in the lap is reduced, not only that of the last one. The figure also shows the
weakness of the method, since a single false match folds the map and produces a
larger error than odometry alone. Recognizing places reliably, and limiting the
influence of matches that are wrong, are therefore a large part of current SLAM
systems.

## A camera and an inertial sensor { #visual-inertial }

An inertial sensor is fast but drifts within seconds. A camera observes fixed
points in the scene, and a point that is seen from several positions constrains
how far the camera moved between them. The multi-state constraint Kalman filter
(MSCKF) of [Mourikis and Roumeliotis](https://doi.org/10.1109/ROBOT.2007.364024)
(2007) made this combination affordable by keeping a short window of recent
camera poses in the filter and leaving the observed points out of it. A second
idea, [preintegration](https://doi.org/10.15607/RSS.2015.XI.006) (2015, with two
Georgia Tech authors), summarizes the hundreds of inertial samples between two
camera frames as a single constraint. We refer to the result as visual-inertial
odometry, and it is the standard source of position for a drone without GPS.

<figure class="fig" data-figure="vio">
<figcaption>The dark drone is the truth. The brass drone integrates the inertial
sensor alone. The blue drone also uses the camera, and the blue points behind it
are the window of recent poses that it re-estimates at each frame. Red points
are the features in view. This is a simplified model: the heading is taken as
known, and the camera measures the position of each feature relative to the
drone.</figcaption>
</figure>

With the default settings, the inertial estimate is several metres off after one
minute and the combined estimate is about 0.3 m off. Reducing the camera range
leaves fewer features in view, and the combined estimate approaches the inertial
one. The combined estimate still drifts, because none of its measurements refers
to a fixed frame, and this is the difference between odometry and localization.
On a drone, the output is typically passed to the flight controller's EKF as one
more measurement.

## Localizing against a prior map { #map-localization }

Odometry of any kind drifts, and satellite positioning is accurate to about a
metre, which is not sufficient to keep a car in its lane. Levinson and Thrun
([2010](https://fileadmin.cs.lth.se/ai/Proceedings/ICRA2010/MainConference/data/papers/1912.pdf))
removed this error with a map made in advance. The map stores how strongly each
15 cm cell of the road surface reflects the lidar, and while driving the vehicle
searches for the small offset at which its current scan best matches the map.
In their test, the lateral error fell from 66 cm to 9 cm. Most self-driving
systems that followed were built on this approach.

<figure class="fig" data-figure="maploc">
<figcaption>The road is the stored map. The dark rover is the truth, the brass
rover is the position from satellite and inertial sensors, and the blue rover is
that position after matching. Red points are the current lidar scan, darker
where the surface is brighter. The surface on the right is the belief over the
offset between the two positions.</figcaption>
</figure>

With a dashed centre line, the belief has a single peak and the error falls to a
few centimetres in both directions. With solid lines only, the scan looks the
same wherever the car is along the road, so the belief becomes a ridge and the
error along the road is not corrected. A measurement can therefore only correct
the directions in which the scene varies, and a map-based localizer is only as
good as the features in its map.

## Smoothing with factor graphs { #factor-graphs }

The pose graph and the window of camera poses are two cases of one structure. A
factor graph has a node for each unknown (e.g., a pose or a landmark) and a
factor for each measurement that relates some of them, and the estimate is the
set of values that best satisfies all of the factors. Solving for past poses as
well as the current one is called smoothing. It was long considered too slow to
run online, until Dellaert and Kaess at Georgia Tech showed that the sparse
structure of the graph makes it efficient, and that the solution can be updated
incrementally as measurements arrive
([iSAM2](https://doi.org/10.1177/0278364911430419), 2012). Their library,
[GTSAM](https://github.com/borglab/gtsam), is the one that the
[ripple](../ripple.md) track uses.

<figure class="fig" data-figure="smooth">
<figcaption>The dark rover is the truth, and red points are occasional position
fixes. The brass line is each pose as it was first estimated, which is what a
filter reports. The blue line is the same poses after later measurements have
been applied, and the blue points are the poses still held as variables. With
one pose kept, the smoother is a filter.</figcaption>
</figure>

The estimate of the newest pose is the same in both cases. The difference lies
in the earlier poses: the filter's path jumps at each fix, while the smoothed
path applies each fix to the poses before it, and its error is about 40% lower
once the window spans one interval between fixes. This matters whenever earlier
poses are used again (e.g., to place lidar scans in a map, or to apply a
measurement that arrives late).

## Moving objects in the estimate { #slammot }

SLAM assumes that the world is static, and tracking assumes that the pose of the
sensor is known. In traffic both assumptions fail at once. Wang and colleagues
at Carnegie Mellon ([2007](https://doi.org/10.1177/0278364907081229)) named the
combined problem SLAMMOT: simultaneous localization, mapping, and moving object
tracking. They described two solutions. The first is a joint estimate over the
robot, the map, and every moving object, which they judged infeasible at the
time. The second separates the measurements into static and moving, and runs a
SLAM estimator and a tracker side by side.

<figure class="fig" data-figure="slammot">
<figcaption>The dark rover and drone are the truth, and the blue ones are the
estimates. The rover localizes from the grey landmarks, and tracks the drone
from range and bearing measurements (red line), which it places in the world
with its own estimated pose. "Treat the drone as a landmark" gives the localizer
the drone as if it were fixed where it was first seen.</figcaption>
</figure>

The two estimators depend on each other in both directions. Without landmark
fixes, the rover's estimate drifts and the drone track drifts with it, since the
track can be no more accurate than the pose that places it. When the drone is
taken for a landmark, the error enters the other way and the rover's own
estimate is pulled by more than a metre. The joint estimate that Wang set aside
is now practical with factor graphs, although it is not settled:
[DynoSAM](https://github.com/ACFR-RPG/DynOSAM) (2025) is built on GTSAM, and its
authors state that the formulation of the problem remains open. Comparing the
separate and the joint estimators is the long-term goal of the ripple track.

## Where the field is now

The estimators that are documented in deployed systems remain classical. A
typical drone runs an error-state EKF in the flight controller (PX4 EKF2 or
ArduPilot EKF3) and passes visual-inertial odometry to it from a companion
computer. The open driving stacks match lidar scans to a map, fuse the result in
an EKF, and track objects with Kalman filters. In the 2026 Hilti-Trimble SLAM
challenge, every leading entry was a classical visual-inertial system.

Learned methods have so far been adopted around these estimators. Networks
produce the detections that a tracker associates and the features that an
odometry system follows, and learned driving and racing policies consume the
output of a filter. Systems that replace the estimator itself (e.g., SLAM built
on feed-forward 3D models, or learned inertial odometry) remain research. Their
main open problem is that a network does not report a trustworthy uncertainty,
which is what a probabilistic estimator requires of each input.

Several of the most cited systems (ORB-SLAM3, VINS-Fusion, LIO-SAM, and
Cartographer) are no longer maintained, and we suggest reading them as reference
code. The projects below were active in late 2026.

| Project | What it provides |
|---|---|
| [GTSAM](https://github.com/borglab/gtsam) | Factor graphs, iSAM2, and preintegration, with Python bindings and notebooks |
| [FilterPy](https://github.com/rlabbe/filterpy) | Small, readable Kalman, unscented, and particle filters |
| [PX4 EKF2](https://github.com/PX4/PX4-Autopilot) | A flight-tested error-state EKF that runs in simulation on a laptop |
| [robot_localization](https://github.com/cra-ros-pkg/robot_localization) | The standard ROS 2 package for fusing odometry, inertial, and GPS data |
| [Stone Soup](https://github.com/dstl/Stone-Soup) | Tracking and data association |
| [KISS-ICP](https://github.com/PRBonn/kiss-icp) | Lidar odometry that installs with pip |
| [OpenVINS](https://github.com/rpng/open_vins) | An MSCKF visual-inertial estimator written to be read |
| [DynoSAM](https://github.com/ACFR-RPG/DynOSAM) | Joint estimation of the camera, the map, and moving objects |
| [evo](https://github.com/MichaelGrupp/evo) | The standard trajectory error metrics |

Most of the core reading is free. We suggest Labbe's
[Kalman and Bayesian Filters in Python](https://github.com/rlabbe/Kalman-and-Bayesian-Filters-in-Python)
for filters, Dellaert and Kaess's
[Factor Graphs for Robot Perception](https://www.cs.cmu.edu/~kaess/pub/Dellaert17fnt.pdf)
for smoothing, and the
[SLAM Handbook](https://github.com/SLAM-Handbook-contributors/slam-handbook-public-release)
for everything after that.
