---
icon: lucide/book-open
---

# Control

A drone that knows where it is still has to get where it is going. A controller
takes the estimated state of the vehicle and a setpoint (e.g., an altitude to
hold) and computes the motor commands that bring the state to the setpoint.
Control is the problem of computing those commands so that the vehicle arrives
quickly, does not overshoot, and holds its place when something pushes on it.

This page develops the main ideas in order, using one small quadrotor as the
running example. We start with a controller that reacts to the current error and
add one term at a time, then show what the limit on motor thrust does to it, and
finally arrive at a controller that plans ahead with a model of the vehicle and
whose settings can be trained. Each figure is interactive and can be rotated by
dragging. The figures run a small simulation of a 1 kg quadrotor that can
produce twice its weight in thrust, not a flight controller.

## Feedback

The simplest controller commands the thrust that a model says will hold the
vehicle in the air (i.e., its weight) and never checks the result. This is
called open-loop control, and it is only as accurate as the model. In the figure
below the vehicle is 5% heavier than the controller assumes, so with feedback
disabled the hover thrust falls short and the drone sinks to the ground.

Feedback control measures the altitude and acts on the error, which is the
setpoint minus the measurement. Proportional action adds thrust in proportion
to the error. Derivative action adds thrust in proportion to how quickly the
error is shrinking or growing, which opposes the vehicle's velocity.

<figure class="fig" data-figure="feedback">
  <figcaption>The dark line is the altitude over the last eight seconds and the teal line is the setpoint. The red bar beside the drone is the current error.</figcaption>
</figure>

Both terms are necessary. With the derivative gain at zero, the drone passes
through the setpoint at full speed and oscillates around it, because
proportional action behaves as a spring and nothing removes the energy. The
derivative term supplies the damping. The two gains together determine how the
loop responds: the proportional gain sets its natural frequency, and the
derivative gain sets the damping ratio, where a value near one settles without
overshoot.

Note that the drone settles 12 cm below the setpoint. Proportional action
produces thrust only when there is an error, so the missing 5% of hover thrust
is paid for with a constant error.

## Integral action

A larger proportional gain shrinks this offset but cannot remove it. Integral
action removes it by adding a third term in proportion to the accumulated error.
As long as any error remains, the accumulated error keeps growing and the thrust
keeps rising, so the loop can only come to rest where the error is zero. The
figure below adds a payload of 10% of the vehicle's mass that the controller
does not know about.

<figure class="fig" data-figure="integral">
  <figcaption>Brown is the controller from the previous section, and dark is the same controller with integral action. Both carry the same payload.</figcaption>
</figure>

Without integral action the drone hangs 24 cm low. With it, the integral term
settles at the thrust the payload requires, so integral action can be understood
as a way of finding the part of the hover thrust that the model left out. The
three terms together are a PID controller.

The integral term has a cost. It responds to the past, so it continues to push
after the error has changed sign, and the drone now overshoots each step by
more than 20%. Raising the integral gain further makes the overshoot larger, and
above a threshold the loop oscillates with growing amplitude.

## The thrust limit

The preceding sections assumed that the motors deliver whatever thrust the
controller requests. They cannot: this vehicle can accelerate upward at no more
than 9.8 m/s² and, with the motors off, downward at the same rate. When the
controller requests more than that, the motors saturate, and the vehicle no
longer responds to further changes in the request.

<figure class="fig" data-figure="limit">
  <figcaption>In the chart, red is the thrust the controller requests, dark is the thrust the motors deliver, and the dashed line is the most they can produce.</figcaption>
</figure>

Saturation first damages the integral term. During a long climb the error stays
large, so the accumulated error grows far beyond any value that is useful, and
the drone overshoots by 66% of a 3 m step while it unwinds. This is called
windup. The standard repair is to stop accumulating while the motors are
saturated, which reduces the overshoot to 32%.

The remaining overshoot is not caused by the integral term, since disabling it
leaves 30%, and it grows with the size of the step: 9% for 1 m, 30% for 3 m, and
55% for 10 m. The cause is that the controller begins to brake at a distance
proportional to its speed, while the distance needed to stop under a thrust
limit grows with the square of the speed. A controller that reacts to the
current error has no knowledge of its own braking distance.

## Limits on the gain

It would seem that a sufficiently high gain makes every error small. Three
properties of a real vehicle prevent this. The altitude measurement is noisy,
the motors take time to change speed (about 50 ms here), and there is a delay
between a measurement and the resulting thrust (30 to 40 ms has been measured on
research quadrotors[^faessler]).

<figure class="fig" data-figure="gain">
  <figcaption>The loop speed slider sets both gains so that the damping ratio stays at 0.7. The noise is 1 cm on each altitude measurement.</figcaption>
</figure>

The derivative term amplifies noise, because the difference between two noisy
measurements taken 10 ms apart is mostly noise. In the default state, 1 cm of
measurement noise becomes about 10 m/s² of variation in the thrust command. A
20 ms filter on the derivative reduces this by a factor of three. A 100 ms
filter reduces it further but adds its own delay, and the overshoot rises from
10% to about 50%.

Lag and delay limit the gain directly. Raising the loop speed from 5 to 10 rad/s
with the same damping ratio raises the overshoot from 10% to about 60%, because
the controller now reacts faster than the thrust can follow. Raising the delay
to 150 ms makes the default loop unstable. The usable gain is therefore finite,
and it is set by the slowest element between the measurement and the thrust.

## Cascaded loops

Holding altitude does not hold position. A quadrotor has no motor that pushes
sideways, so it moves horizontally by tilting its thrust, and position is
therefore controlled through attitude. The standard structure is a cascade: an
outer loop converts the position error into a tilt setpoint, and an inner loop
tilts the vehicle to match it.

<figure class="fig" data-figure="cascade">
  <figcaption>The dark arrow is the thrust, and the teal arrow is the direction the position loop asks for. The drone is seen from the side.</figcaption>
</figure>

The cascade works only if the inner loop is faster than the outer one. To the
position loop, the attitude loop is a lag of the kind examined in the previous
section. With the attitude loop four times faster, the move overshoots by 6%;
at equal speeds it overshoots by 45%, and below that the vehicle is unstable.
Tilting also reduces the vertical component of the thrust, so the controller
must increase the thrust as it tilts, and without that correction the drone
sinks during every move.

Flight controllers are built this way. PX4, a widely used open-source
autopilot, runs four nested loops (position, velocity, attitude, and body rate),
with the innermost at 400 Hz by default, and limits each setpoint before passing
it down (e.g., the tilt limit in the figure).[^px4] Every gain and every limit
in that structure is chosen by hand.

## Gains from a cost

The gains above were chosen by trial. An alternative is to state what we want
and compute the gains from it. We write a model of the vehicle (here, one
horizontal axis, where the input is an acceleration) and a cost that penalizes
position error, velocity, and control effort, each with a weight. For a linear
model and a quadratic cost, the controller that minimizes the cost is a fixed
gain on each state, and it is called the linear quadratic regulator (LQR).

<figure class="fig" data-figure="lqr">
  <figcaption>The dark line behind the drone is the path already flown, with time running into the screen, and the teal line is the target. The acceleration is limited to 5 m/s², which corresponds to a tilt of about 27°.</figcaption>
</figure>

For this model the result is a proportional gain and a derivative gain, as in
the first section, but they are now computed from the weights. Increasing the
position weight raises both gains together, and the response remains well damped
at every setting, so the weights are easier to choose than the gains.

The regulator is still feedback on the current state, and its derivation assumes
that any acceleration is available. On the 5 m move the limit is reached only
briefly and the result is good. On the 20 m move the drone reaches almost 12 m/s
and overshoots the target by 7.3 m, for the reason given in the section on the
thrust limit.

## Model predictive control

With a limit on the input, the best controller is no longer a fixed gain. Model
predictive control (MPC) instead solves for it numerically at every step. From
the current state, it uses the model to find the sequence of inputs over a
finite horizon that minimizes the cost while respecting the limit. It applies
the first input of that sequence, discards the rest, and solves again from the
next measured state.

<figure class="fig" data-figure="mpc">
  <figcaption>Dark is the drone flown by MPC, and the blue ribbon ahead of it is its current plan. Brown is the regulator from the previous section, with the same weights and the same limit. Teal is the target. The lines behind each drone are the paths already flown, with time running into the screen.</figcaption>
</figure>

Because the plan includes the limit, it includes the braking distance. With a
horizon of 2 s, the drone begins to brake while it is still far from the target
and overshoots by 0.8 m where the regulator overshoots by 7.3 m. The horizon
must be long enough to contain the stop: with 1 s the overshoot is 2.9 m, and
with 0.5 s it is 5.3 m, since the drone needs 2 s to stop from its peak speed.

The plan is never flown as a whole. Pressing **shove** changes the velocity of
both drones, and the plan is different at the next step, because every solve
begins from the measured state. This repeated solving is what makes MPC a
feedback controller.

MPC is limited by its model. With **wind** enabled, the drone rests about 25 cm
from the target, as the proportional controller did under a payload, because the
model does not include the wind. Estimating the unmodeled force from the
difference between the predicted and measured velocity, and adding it to the
model, removes the offset; this is integral action applied to the model. MPC
also costs computation. In one comparison on a racing quadrotor, MPC needed
2.7 ms per command against 0.02 ms for a cascaded controller with the same
inner loop, and the two tracked nearly equally well except on trajectories that
demanded more thrust than the vehicle had, where MPC was the more accurate.[^sun]

## Trained weights

The controller of the previous section still depends on numbers that we chose
by hand, namely the weights of its cost. The flight that results is a function
of those weights, so we can assign a score to a set of weights by flying a batch
of flights with them, and then adjust the weights in the direction that improves
the score. This is the same procedure used to train a neural network, applied to
a controller that has two parameters in place of millions.

<figure class="fig" data-figure="train">
  <figcaption>The height of the surface is the score of a batch of 20 m moves at each pair of weights, where lower is better. The slope is estimated by finite differences.</figcaption>
</figure>

In the figure, each flight in the batch has a tailwind gust, a motor lag, and a
delay that the controller's model omits, and a wall stands 1.5 m past the
target. The hand-tuned weights of the previous section fly well without these
disturbances and pass the wall in all eight flights with them. Pressing
**train** lowers the position weight by roughly a factor of seven and raises
the velocity weight by a factor of five, which makes the drone approach more
slowly, and it then stops short of the wall in all eight.

What the training sees matters. With the disturbances removed from the training
flights, training sharpens the response on the undisturbed flight, and the
resulting weights still pass the wall in all eight disturbed flights.

DiffMPC, from Toyota Research Institute, performs this training efficiently for
controllers with many parameters, by computing the slope directly from the
solver in place of finite differences.[^diffmpc] Its authors trained the 14
parameters of a controller for a drifting car on a track with randomized
puddles, and on the real car the trained controller completed a maneuver on
which the hand-tuned one spun out. Whether a drone's controller trained this
way survives a disturbance that a hand-tuned one does not has not been shown.

## Running an experiment

[diffmpc-drones](../diffmpc.md) is the repo we use for control experiments. It
currently reproduces DiffMPC's quadrotor example, which trains the cost weights
of a hover controller:

```sh
uv run diffmpc-drones
```

The simulated drone in that example is the same model the controller plans
with, so nothing in the training resembles the gusts, lag, and thrust limit on
this page. Adding a separate simulator that has them is the first piece of work
in the control area.

[^faessler]: Faessler, Franchi, and Scaramuzza, [Differential flatness of quadrotor dynamics subject to rotor drag](https://arxiv.org/abs/1712.02402), 2018.
[^px4]: [PX4 controller diagrams](https://docs.px4.io/main/en/flight_stack/controller_diagrams.html) and parameter reference.
[^sun]: Sun et al., [A comparative study of nonlinear MPC and differential-flatness-based control for quadrotor agile flight](https://arxiv.org/abs/2109.01365), 2022.
[^diffmpc]: Adabag, Greiff, Subosits, and Lew, [Differentiable model predictive control on the GPU](https://arxiv.org/abs/2510.06179), 2025.
