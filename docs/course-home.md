---
icon: lucide/house
---

# Course Home

!!! note "Instructor"

    Taught by **Ethan Boos**, robotics engineer at [Georgia Tech Research
    Institute](https://www.gtri.gatech.edu/) and part-time Robotics PhD student
    at Georgia Tech researching how drones stay reliable when their model of
    the world is wrong.

GT Cloud Robotics is a [Vertically Integrated Projects](https://vip.gatech.edu/)
course at Georgia Tech. The projects are all on drones, and they fall into three
focus areas: sensor fusion, control, and learning. Each area has a repo that
already runs and one problem I want to solve with it. You pick an area, group up
into a subteam for it, and work toward that problem. Each subteam commits to a
demo of its progress every two weeks.

## Sensor fusion

The repo is [isaacdrones](isaacdrones.md), which simulates a drone's sensors in
NVIDIA Isaac Sim and publishes them over ROS 2.

The problem is whether simulated sensors are good enough to develop an estimator
against. Right now the drone has one sensor, a camera, and it can fly through a
warehouse or over the Georgia Tech campus. The work is to make that camera
behave like a real one, add an IMU and a lidar, and then build an estimator on
them in ROS 2. The simulator knows where the drone really is, so you can always
check your answer.

Read the [Sensor Fusion intro](sensor-fusion/intro.md) first.

## Control

There are two repos. [diffmpc-drones](diffmpc.md) tunes a drone's model
predictive controller by training it, using Toyota Research Institute's DiffMPC.
[onegraph](onegraph.md) puts a drone's estimator and its model predictive
controller in one factor graph.

The problem is a controller that survives a disturbance (e.g., a gust of wind
or heavy rain) that a hand-tuned one does not. A hand-tuned controller is
tuned on the few cases someone thought to try. A neural network policy is
trained on thousands of cases, but you can't read a model or a constraint out
of it. A trained MPC keeps the model and the constraints and still gets tuned
on thousands of randomized flights. Toyota showed this on a car, and whether it
carries over to a drone is open.

onegraph tries something else. An estimator and a controller are usually built
and tuned separately, and the controller flies as if the estimate were exact.
Frank Dellaert, whose group at Georgia Tech maintains GTSAM, has [proposed
putting both in one
graph](https://gtsam.org/2026/04/21/factor-graphs-and-world-models.html): a
smoother over the last few seconds and a model predictive controller over the
next few. Whether that is more robust is open too.

Read the [Control intro](control/intro.md) first.

## Learning

A learned model needs many flights to train on and somewhere to fail safely, and
both come from simulation. So the learning work right now is simulation work, in
[splatsim](splatsim.md), which replays a real flight inside a Gaussian splat of
the place it flew through.

The problem is knowing when a simulated image can be trusted. A model trained or
tested in simulation is only as good as the simulation, and right now nobody can
say how good that is for a given frame. I want a way to predict it before
relying on the render.

The [World Models intro](world-models/intro.md) covers what gets trained once
the simulation is there.
