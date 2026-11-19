---
icon: lucide/flask-conical
hide:
- toc
---

# DiffMPC on drones

**DiffMPC** ([paper](https://arxiv.org/abs/2510.06179),
[code](https://github.com/ToyotaResearchInstitute/diffmpc)), from Toyota
Research Institute, tunes a model predictive controller by training it. It simulates the
controller under randomized conditions, takes the gradient of the reward through
the controller, and adjusts the cost weights and the physical parameters of the
model the controller plans with. The authors used it to drift a Toyota Supra
through water puddles, where the hand-tuned controller spun out. The goal of
this track is to find out whether the same method gives a drone controller that
survives a disturbance (e.g., a wind gust or a dropped payload) that a
hand-tuned one does not.

## Working up to a first experiment

Toyota's repo already includes a quadrotor model and a notebook that trains the cost
weights of a hover controller, so the method runs on a drone on the first day.
The notebook has one drone, no randomization, and no actuator limits, and the
work of this track is what it leaves out. Two things look hard. The solver has no
inequality constraints, so thrust limits cannot be part of the controller's
problem; the paper enforces limits in the simulator only and lets training learn
to stay away from them. Training also needs a simulator that can be
differentiated, which Isaac Sim is not, so [isaacdrones](isaacdrones.md) can
test a trained controller but cannot train one.

The first experiment is therefore in a simulator written in JAX. We add thrust
limits to it, randomize mass, drag, and wind across a batch of drones, and train
the cost weights together with the mass and thrust parameters of the model. We
then compare the trained controller with the starting one on a disturbance that
neither was trained on.

The result we would most like to see is the one the paper reports for the car.
Training lowered the tire friction the controller assumes by 13%, so the
controller plans as if it has less grip than it does. The equivalent for a drone
is a controller that learns to assume less thrust than it has, and because the
learned parameters are physical quantities, we can check whether they make
sense.

!!! note "No repo yet"

    This track has no repo yet, and nothing on this page has been run. The
    drifting result took 14 hours on an
    RTX 4090, and the authors report that training can diverge from a poor
    initial guess. The license on Toyota's repo is non-standard, so read `LICENSE.txt` before
    building on it.
