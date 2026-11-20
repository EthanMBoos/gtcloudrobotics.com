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

The repo is [ripple](ripple.md), a multi-agent simulator that keeps apart where
a drone is and where its software thinks it is.

The problem is SLAMMOT: localization, mapping, and moving object tracking in one
estimator. These are usually solved separately, and each one assumes the others
are already right. A drone flying among other vehicles gets none of that, so its
position error ends up in every track and moving objects end up in the map. I
want to know how much a joint estimator gains over separate ones, and what it
costs to run.

Read the [Sensor Fusion intro](sensor-fusion/intro.md) first.

## Control

The repo is [diffmpc-drones](diffmpc.md), which tunes a drone's model predictive
controller by training it, using Toyota Research Institute's DiffMPC.

The problem is a controller that survives a disturbance (e.g., a wind gust or a
dropped payload) that a hand-tuned one does not. A hand-tuned controller is
tuned on the few cases someone thought to try. A neural network policy is
trained on thousands of cases, but you can't read a model or a constraint out
of it. A trained MPC keeps the model and the constraints and still gets tuned
on thousands of randomized flights. Toyota showed this on a car, and whether it
carries over to a drone is open.

## Learning

A learned model needs many flights to train on and somewhere to fail safely, and
both come from simulation. So the learning work right now is simulation work, in
two repos: [isaacdrones](isaacdrones.md), a small drone simulation base on
NVIDIA Isaac Sim, and [splatsim](splatsim.md), which replays a real flight
inside a Gaussian splat of the place it flew through.

The problem is knowing when a simulated image can be trusted. A model trained or
tested in simulation is only as good as the simulation, and right now nobody can
say how good that is for a given frame. I want a way to predict it before
relying on the render.

The [World Models intro](world-models/intro.md) covers what gets trained once
the simulation is there.
