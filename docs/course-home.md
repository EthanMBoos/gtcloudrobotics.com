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
focus areas: sensor fusion, control, and learning. Each area has a repo and one
problem I want to solve with it. You pick an area, group up into a subteam for
it, and work toward that problem. Each subteam commits to a demo of its progress
every two weeks.

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

The repo is [diffmpc-drones](diffmpc.md), which tunes a drone's model
predictive controller by training it, using Toyota Research Institute's DiffMPC.

The problem is a controller that survives a disturbance (e.g., a gust of wind
or heavy rain) that a hand-tuned one does not. A hand-tuned controller is
tuned on the few cases someone thought to try. A neural network policy is
trained on thousands of cases, but you can't read a model or a constraint out
of it. A trained MPC keeps the model and the constraints and still gets tuned
on thousands of randomized flights. Toyota showed this on a car, and whether it
carries over to a drone is open.

Read the [Control intro](control/intro.md) first.

## Learning

The repo is [flightwam](flightwam.md). I am not sure what is best, so I am
trying a few angles.

The problem is what a learned world model should do for a drone. A world model
predicts what the robot will see next if it takes some action. The newest robot
arm models (e.g., NVIDIA's GR00T 2) are built on one: they generate the next
camera frames and the next actions together, and a language model sits on top
and tells them what to do. Almost none of that has been tried on a drone.

The [World Models intro](world-models/intro.md) covers the background.
