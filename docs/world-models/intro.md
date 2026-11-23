---
icon: lucide/book-open
---

# World Models

A world model is a learned model that predicts how the state of the world will
change in response to a robot's actions. Such a model allows the robot to
evaluate candidate actions by predicting their outcomes instead of executing
them, which makes it possible to plan.

This page develops the main ideas in order, using a drone as the running
example. We start with how camera images are compressed into a representation
suitable for prediction, then describe single-step prediction, multi-step
rollouts, and planning, and finally examine two concerns that shape how such a
model is used: generalization beyond the training data, and the division of
work between a fast learned model and a slower language model. Each figure is
interactive and can be rotated by dragging. The figures run a small hand-written
simulation in place of a trained network, which we note where it matters.

## Pixels to a latent

Camera images are a poor representation for prediction: an image contains a
large number of values, most of which (e.g., texture and lighting) are
irrelevant to control. The world models studied in this track therefore do not
predict images directly. Instead, an encoder maps each camera frame to a short
vector, which we refer to as the latent, and the model makes its predictions in
this latent space.

<figure class="fig" data-figure="encode">
  <figcaption>Left: the drone orbiting a scene. Top right: its camera frame at 16 × 12 pixels. Bottom right: the latent for that frame, and the curve traced over one lap. The encoder is a fixed random projection rather than a trained network, and practical latents are much longer than three numbers.</figcaption>
</figure>

In the figure, each frame from the drone's camera is reduced to 16 × 12 pixels
and then mapped to a latent of three numbers. A single frame corresponds to a
single point in latent space, and a lap around the scene traces a closed curve,
because nearby viewpoints produce similar frames and therefore nearby latents.
Changing the orbit changes the frames and hence the curve. A trained encoder has
the same structure as the one in the figure, but its weights are learned so that
frames which differ in ways that matter for control are mapped far apart.

## Predict the next latent

Given a latent, the task of the model is to predict the latent at the next time
step. This prediction must depend on the action, since different actions lead to
different outcomes from the same state. The model is therefore a function of two
inputs, the current latent and a candidate action, and its output is the
predicted next latent.

<figure class="fig" data-figure="step">
  <figcaption>The state is drawn as a position so that it is visible; in a trained model it is the latent. The arrow buttons are relative to the initial view.</figcaption>
</figure>

The figure shows the predictions that the model makes for five candidate actions
from the current state. When an action is executed, the drone arrives near the
predicted state but not exactly at it, and each red segment marks the difference
between one prediction and its outcome. We refer to this difference as the
one-step prediction error. In this example the error is caused by wind, which
affects the drone but is absent from the model.

## Rollouts

A single step covers a short interval (one second in the figure above), while
planning requires predictions over longer horizons. To predict further ahead,
the model is applied repeatedly, with each predicted state used as the input to
the next step. We refer to such a sequence of predictions as a rollout. Because
each step starts from a state that already contains error, the errors compound.

<figure class="fig" data-figure="rollout">
  <figcaption>Dark is the trajectory the drone flew, and blue is the rollout of the model under the same actions. Red segments connect the two at equal times.</figcaption>
</figure>

The figure compares a rollout with the trajectory that the drone actually flew
under the same actions. The gap between them increases with the horizon, and it
increases faster when the model is less accurate. The error can be reset by
re-anchoring, i.e., restarting the rollout from a real observation, and doing so
more frequently keeps the rollout closer to the true trajectory. The horizon
over which a model remains accurate is therefore one of its most important
properties, and it is the first quantity to measure when training a model on new
flight data.

## Planning

A model that predicts the outcome of actions can be used to choose them. The
simplest approach is planning by sampling: we sample many candidate action
sequences, compute a rollout for each one, and score each rollout by how close
it ends to the goal. The figure uses the cross-entropy method (CEM), which
repeats this procedure several times, each time sampling new candidates around
the best-scoring ones from the previous pass. Model predictive path integral
control (MPPI) is a closely related method.

<figure class="fig" data-figure="plan">
  <figcaption>Grey lines are sampled rollouts, green lines are the best-scoring samples, blue is the resulting plan, and dark is the trajectory the drone flew.</figcaption>
</figure>

Because the plan is computed in the model but executed in the real dynamics,
model error becomes execution error: the drone follows the plan and does not
stop at the goal. Replanning addresses this without improving the model. With
replanning enabled, the drone executes only the first action of each plan,
observes the resulting state, and plans again from there, so each plan needs to
be accurate only over a short interval.

## Unseen flights

The accuracy of a learned model depends on its training data. A model can
predict well in situations that resemble those it was trained on, and it has no
basis for accurate prediction elsewhere. In the figure, the model has learned
the effect of wind only in the region covered by its training flights.

<figure class="fig" data-figure="unseen">
  <figcaption>The red surface is the one-step prediction error of the model at each position. It is low only near the training flights, which are shown in brown.</figcaption>
</figure>

When the test flight is close to the training flights, the rollout follows the
true trajectory closely. As the test flight moves away, the rollout diverges,
even though the model and the actions are the same. Adding the test flight to
the training data restores the accuracy in that region.

For this reason, a model should be evaluated on flights that were not used to
train it.

## Two layers

The components above form the fast, low-level layer of a drone: a model that
predicts and a planner that selects actions many times per second. The design
studied in this course places a large language model (LLM) above this layer to
interpret instructions and select behaviors. An LLM cannot
perform the low-level role itself, because it observes the scene roughly once
per second and requires additional time to respond.

<figure class="fig" data-figure="rates">
  <figcaption>The timeline shows when each layer runs. The rates are examples; actual rates depend on the models and the vehicle.</figcaption>
</figure>

The figure compares two ways of using the LLM to follow a moving rover. When the
LLM sends every position setpoint, each setpoint is out of date by the time it
arrives, and the drone trails the rover by a distance that grows with both the
latency and the speed of the rover. When the LLM instead selects a skill once
(e.g., `follow(rover)`) and a fast layer performs the tracking, the latency of
the LLM no longer affects tracking accuracy. This division of responsibility,
in which the LLM decides what to do and a fast learned layer decides how, is the
architecture that this part of the course aims to build.
