---
icon: lucide/file-text
---

# Background

This page gives a brief history of world models for autonomous vehicles,
drones, and robot arms, and then examines nine ideas from that history that you
are likely to meet in current papers and code. The timeline covers the full period. The
sections below it concentrate on the points from 2018 onward, because the
earlier ones (planning with a model, and the growth of error over a rollout)
are the subject of the [intro page](intro.md). The figures are small
simulations written for this page. None of them runs a trained network.

<div class="tl">
<div class="tl-item tl-theory"><span class="tl-year">1978</span><span class="tl-name">Model predictive control</span><span class="tl-note">Plan, apply one move, repeat</span></div>
<div class="tl-item tl-theory"><span class="tl-year">1990</span><span class="tl-name">Dyna</span><span class="tl-note">Learn inside a learned model</span></div>
<div class="tl-item tl-road"><span class="tl-year">2017</span><span class="tl-name">MPPI on AutoRally</span><span class="tl-note">Sampling control through a learned network</span></div>
<div class="tl-item tl-theory"><span class="tl-year">2018</span><span class="tl-name"><a href="#exploitation">World Models</a></span><span class="tl-note">A policy trained in its dream</span></div>
<div class="tl-item tl-road"><span class="tl-year">2019</span><span class="tl-name"><a href="#branching">MultiPath</a></span><span class="tl-note">Several futures, each with a probability</span></div>
<div class="tl-item tl-theory"><span class="tl-year">2020</span><span class="tl-name"><a href="#horizon">Dreamer</a></span><span class="tl-note">Short imagined rollouts and a value</span></div>
<div class="tl-item tl-air"><span class="tl-year">2022</span><span class="tl-name"><a href="#residual">Neural-Fly</a></span><span class="tl-note">Physics plus an adapting residual</span></div>
<div class="tl-item tl-arm"><span class="tl-year">2023</span><span class="tl-name"><a href="#branching">Diffusion Policy</a></span><span class="tl-note">Demonstrations beat models on arms</span></div>
<div class="tl-item tl-road"><span class="tl-year">2023</span><span class="tl-name">GAIA-1</span><span class="tl-note">Driving video generated as tokens</span></div>
<div class="tl-item tl-air"><span class="tl-year">2024</span><span class="tl-name"><a href="#reconstruction">Splat simulators</a></span><span class="tl-note">Fly inside a reconstructed scene</span></div>
<div class="tl-item tl-arm"><span class="tl-year">2024</span><span class="tl-name"><a href="#wam">Latent actions</a></span><span class="tl-note">Action labels inferred from video</span></div>
<div class="tl-item tl-arm"><span class="tl-year">2025</span><span class="tl-name"><a href="#chunks">π0.5</a></span><span class="tl-note">A subtask in words, then actions</span></div>
<div class="tl-item tl-theory"><span class="tl-year">2025</span><span class="tl-name"><a href="#embeddings">V-JEPA 2</a></span><span class="tl-note">Predict embeddings, not pixels</span></div>
<div class="tl-item tl-air"><span class="tl-year">2025</span><span class="tl-name">Dream to Fly</span><span class="tl-note">A Dreamer latent races drones</span></div>
<div class="tl-item tl-road"><span class="tl-year">2026</span><span class="tl-name"><a href="#evaluation">openpilot 0.11</a></span><span class="tl-note">A policy trained in the model ships</span></div>
<div class="tl-item tl-arm"><span class="tl-year">2026</span><span class="tl-name"><a href="#wam">GR00T 2</a></span><span class="tl-note">Video and actions generated together</span></div>
</div>
<div class="tl-key"><span class="tl-theory">shared methods</span><span class="tl-road">road vehicles</span><span class="tl-air">drones</span><span class="tl-arm">manipulation</span></div>

## From process control to learned models

The planning loop is older than the learned model. Model predictive control
came out of refineries in the 1970s
([Richalet and colleagues](<https://doi.org/10.1016/0005-1098(78)90001-8>),
1978): the controller rolls a model forward for candidate actions, applies the
first action of the best sequence, measures, and plans again. The models in
those controllers were already fitted from plant data, although they were
linear and described a few measured variables. The
[Planning](intro.md#planning) section of the intro page shows the same loop.

Around 1990, three groups independently proposed training the controller
inside a learned model. Sutton's
[Dyna](https://doi.org/10.1016/B978-1-55860-141-3.50030-4) updated a value
function on transitions sampled from the model, Nguyen and Widrow trained a
network to back a simulated truck to a loading dock through a second network
that imitated the truck, and Schmidhuber paired a recurrent model with a
recurrent controller. The first convincing flight result was Stanford's
autonomous helicopter ([Abbeel, Coates, and Ng](https://doi.org/10.1177/0278364910371999),
2010). Its model had a hand-written structure whose coefficients were fitted to
20 minutes of piloted flight, and aerobatics required a further correction
learned along each maneuver.

Two results complete the period. Venkatraman, Hebert, and Bagnell
([2015](https://ojs.aaai.org/index.php/AAAI/article/view/9590)) showed that the
error of a learned model can grow exponentially with the length of a rollout,
which is the effect in the [Rollouts](intro.md#rollouts) section of the intro
page. At Georgia Tech, Williams and colleagues
([2017](https://doi.org/10.1109/ICRA.2017.7989202)) replaced the hand-derived
vehicle model in their sampling controller (MPPI) with a small neural network,
and raced the one-fifth-scale AutoRally car at over 8 m/s with comparable
results. The planner was unchanged, and only the model was learned.

Robot arms followed a different course. Early work planned with a learned
video model (e.g., [visual foresight](https://arxiv.org/abs/1610.00696), 2017),
and required the robot to collect its own data for hours. In 2023,
[Diffusion Policy](https://arxiv.org/abs/2303.04137) and
[ACT](https://arxiv.org/abs/2304.13705) learned fine manipulation directly from
a few minutes of human demonstrations, with no model of the dynamics. Most
manipulation research then moved to large policies trained on demonstrations,
and the world model returned to arms only in 2025 and 2026, in the forms
described in the later sections.

## A model can be exploited { #exploitation }

Ha and Schmidhuber's [World Models](https://arxiv.org/abs/1803.10122) (2018)
compressed each camera frame to a small latent vector, trained a recurrent
network to predict the next latent, and trained a controller entirely inside
that network's predictions. The paper fixed the vocabulary that the field still
uses. It also documented a failure. In one setting the controller scored 2086
in the model and 193 in the real game, which is below a random policy, because
it had found actions that the model rewarded and the game did not. We refer to
this as model exploitation: an optimizer is drawn to the regions in which the
model is wrong in its favor.

<figure class="fig" data-figure="exploit">
<figcaption>The dark curve is the true reward for taking a corner at each
speed, which rises until the vehicle leaves the track. Red points are noisy
training trials. The blue curve is a model fitted to them, with one standard
deviation of its uncertainty on either side. The blue marker is the speed at
which the model's reward is highest, and the dark marker below it is the reward
actually obtained at that speed. "Penalize uncertainty" subtracts two standard
deviations from the model's reward before choosing.</figcaption>
</figure>

With training trials up to 5 m/s, the model extends the rising trend, and the
optimizer chooses the highest speed that it is allowed. The model promises a
reward of about 7.7 and the true reward is −2. With the penalty, the optimizer
stays at the edge of the data (4.6 m/s on average, for a reward of 4.6 against
a best possible 5.4). When the trials extend past the limit of the track, both
choices agree. The remedies in use follow from this. An ensemble of models
estimates the uncertainty ([PETS](https://arxiv.org/abs/1805.12114), 2018),
and short rollouts limit how far the optimizer can travel from the data
([MBPO](https://arxiv.org/abs/1906.08253), 2019).

## More than one future { #branching }

The future of a road scene is not a single trajectory, because another driver
may turn or continue. A predictor that outputs one trajectory and is trained on
squared error learns the average of the possible outcomes.
[MultiPath](https://arxiv.org/abs/1910.05449) (Waymo, 2019) instead predicts a
fixed set of trajectories and a probability for each. The latent models of the
same period contain the same idea: the state of
[PlaNet](https://arxiv.org/abs/1811.04551) (2019) has a random component, so
that the model can represent a fork instead of its mean.

<figure class="fig" data-figure="branch">
<figcaption>The dark car approaches the intersection and either continues or
turns left. The brass car is ours, and the blue paths are its prediction of the
next four seconds for the dark car. With two trajectories, the opacity of each
path is its probability.</figcaption>
</figure>

When half of the cars turn, the single trajectory leaves the road and ends
inside the corner building, and it misses the path that the car takes by 1.04 m
on average. The nearer of the two trajectories misses by 0.39 m, which is only
the variation in speed between cars. A forecast of this kind is a world model
in a restricted sense, since it predicts what other agents will do and not how
they would respond to our own action. Models that condition on the action of
the vehicle are the subject of the last section.

The same effect appears when a policy is learned from demonstrations. Two
people may pass an obstacle on different sides, and a policy trained to
minimize squared error outputs the average of their actions, which drives into
the obstacle. Diffusion Policy addressed this by generating an action sequence
with a diffusion model, which samples one of the demonstrated behaviors instead
of their mean. This is the action generator inside most current manipulation
models.

## Short rollouts and a value { #horizon }

A long rollout is both expensive and inaccurate, and a short one cannot see a
distant reward. [Dreamer](https://arxiv.org/abs/1912.01603) (2020) resolved
this by learning a value function, which estimates the reward that follows a
given state, and by scoring each short imagined rollout with the value of the
state in which it ends. The policy is then trained entirely on imagined
rollouts. [TD-MPC2](https://arxiv.org/abs/2310.16828) uses the same combination
to plan at each control step.

<figure class="fig" data-figure="horizon">
<figcaption>The rover is rewarded only on reaching the teal goal, which is 18
moves away around the gray wall. The blue path is its current plan. The model
here is exact, so the figure isolates the effect of the horizon. The value is
deliberately rough: it knows the distance to the goal and does not know about
the wall.</figcaption>
</figure>

Without the value, every plan shorter than 18 moves scores zero, and the rover
wanders (with 10 imagined steps it reaches the goal in a quarter of its runs,
by chance). With the value and fewer than 9 steps, the rover drives to the
wall and remains there, because the value is wrong about the wall. With the
value and 9 or more steps, it reaches the goal by the shortest route. Neither
part is sufficient alone: the value supplies what lies beyond the horizon, and
the rollout corrects the value where it is locally wrong.

This is the family of methods that has flown.
[Dream to Fly](https://arxiv.org/abs/2501.14377) (2025) trained DreamerV3 to
race a drone from pixels at 9 m/s, on a task where model-free methods failed
to learn, and [SkyDreamer](https://arxiv.org/abs/2510.14783) reached 21 m/s
with all computation onboard. In both, the world model was learned in a
simulator and not from real flight. This is the approach closest to the
[isaacdrones](../isaacdrones.md) track.

## Physics with a learned residual { #residual }

The rigid-body dynamics of a quadrotor are known, and flight data is expensive
to collect. Most model-based flight controllers therefore learn only the part
that the physics omits (e.g., drag, ground effect, and wind), which we refer to
as a residual. [Neural-Fly](https://arxiv.org/abs/2205.06908) (Caltech, 2022)
writes the residual as a set of basis functions learned offline from 12 minutes
of flight, multiplied by a few coefficients that are adapted during flight. It
tracked trajectories in wind of up to 12 m/s.

<figure class="fig" data-figure="residual">
<figcaption>The drone tracks the teal reference in a gusting wind, shown by
the gray streaks. The red line is its tracking error. All three controllers
use the same rigid-body model. "Fixed residual" adds a drag model fitted in a
4 m/s wind. "Adapting residual" re-estimates the coefficients of that model in
flight. This is a simplified model in which drag is linear in the air speed,
so the adapted model can represent it exactly.</figcaption>
</figure>

In an 8 m/s wind, the tracking error is 48 cm with physics alone, 26 cm with
the fixed residual, and 6 cm with the adapting one. The fixed residual is
accurate only near the wind in which it was fitted, and in still air it is
worse than no residual (24 cm against 9 cm), since it compensates for a wind
that is absent. The comparison explains why the fastest and most accurate
flight results remain hybrids: a bounded residual degrades to the physical
model outside its data, and a model that is entirely learned does not.

## Reconstructing the scene { #reconstruction }

A simulator is a world model written by hand, and its appearance is the part
most often wrong. One remedy is to reconstruct a real scene from recorded
images as a set of 3D Gaussians, and to render new viewpoints from it.
[Splat-Nav](https://arxiv.org/abs/2403.02751) (2024) planned and localized a
drone in such a map, and [SOUS VIDE](https://arxiv.org/abs/2412.16346) trained
a flight policy inside one. This is the approach of the
[splatsim](../splatsim.md) track. The alternative is to generate the scene:
Wayve's [GAIA-1](https://arxiv.org/abs/2309.17080) (2023) predicts driving
video as a sequence of tokens from 4,700 hours of recordings, and can produce
a view of any situation that it is asked for.

<figure class="fig" data-figure="coverage">
<figcaption>The brass line is the recorded flight, with the camera facing
forward. Pale blue ground was in view at some point on that flight. The dark
drone flies a new path, and the ground it has in view is blue where it was
recorded and red where it was not. Gray blocks hide what is behind them.</figcaption>
</figure>

Within 1.6 m of the recorded flight, 98% of the ground in view was recorded.
At 2.4 m the share is 56%, and at 3.6 m it is 15%, because the obstacles hid
that ground from the first flight. A second recording 3 m to the side restores
the share to above 90%. A reconstruction is therefore accurate where the
recording observed the scene and undefined elsewhere, whereas a generative
model is plausible everywhere and has no such guarantee anywhere. Current
driving benchmarks render with reconstruction for this reason.

## Two layers and an action chunk { #chunks }

A large model is too slow to compute an action at every control step.
Manipulation models address this in two ways. The first is to output a sequence
of future actions, called an action chunk, that the robot plays back at a fixed
rate. The second is to place a slow model that decides what to do above a fast
one that decides how. [π0.5](https://arxiv.org/abs/2504.16054) (2025) does this
in a single model, which first writes the next subtask in words (e.g., "pick up
the plate") and then generates the action chunk for it.
[GR00T N1](https://arxiv.org/abs/2503.14734) and Figure's Helix use two
networks and refer to them as System 2 and System 1, after Kahneman's terms for
slow and fast thinking. The intro page describes the same arrangement for a
drone in [Two layers](intro.md#two-layers).

<figure class="fig" data-figure="chunks">
<figcaption>The rover drives toward the teal target, which jumps at random
times. The policy looks at the scene once per chunk and its output arrives
after the inference time. The blue point is the target as the policy last saw
it, which is where the rover is heading. Actions are sent at 50 Hz throughout.</figcaption>
</figure>

The rate at which actions are sent does not determine how quickly the robot
reacts. With 25 actions executed per chunk and 80 ms of inference, the rover
sends actions at 50 Hz, but it responds to a jump of the target after 0.33 s on
average and 0.58 s at worst. The published rates should be read in the same
way. GR00T N1 outputs actions at 120 Hz in chunks of 16, and one chunk takes
64 ms to compute. A π0 policy that [flew a drone](https://arxiv.org/abs/2603.25038)
in 2026 sent position setpoints at 10 Hz in chunks of 50, and so observed the
scene once every five seconds until the chunks were made to overlap. A fast
classical or learned controller therefore remains beneath these models (the
flight controller, in that case), and the slow layer in each of them reasons in
words. None of them predicts the outcome of an action, so they are policies and
not world models.

## Predicting embeddings { #embeddings }

A model that predicts pixels must also predict detail that is irrelevant to
control and often unpredictable (e.g., leaves, textures, and sensor noise).
The joint-embedding predictive architecture (JEPA), proposed by LeCun in 2022,
encodes each observation into an embedding and predicts the next embedding
instead. [V-JEPA 2](https://arxiv.org/abs/2506.09985) (Meta, 2025) pretrained
such an encoder on video, added an action-conditioned predictor trained on 62
hours of robot data, and planned pick-and-place on arms in two laboratories
that it had not seen. The difficulty is that the loss has a trivial solution:
an encoder that maps every observation to the same point predicts perfectly.
We refer to this as representation collapse.

<figure class="fig" data-figure="collapse">
<figcaption>On the left, the drone visits twelve positions on a loop. On the
right, each blue point is the embedding of one position, and each red line
joins a predicted next embedding to the actual one. The encoder and predictor
are linear maps trained by gradient descent. Part of each next position is
random, and its cost is included in the loss.</figcaption>
</figure>

With the regularizer at zero, the embeddings contract to a single point within
about ten seconds and the loss falls to zero, because a smaller embedding makes the
unpredictable part of the loss smaller. The regularizer penalizes any departure of the covariance of the embeddings
from the identity. At its full weight they remain spread and the loss settles
at 0.23. The lower loss therefore belongs to
the encoder that carries no information. Current methods prevent collapse with
a slowly updated copy of the encoder as the target, with a frozen pretrained
encoder, or with a regularizer of this kind
([LeWorldModel](https://arxiv.org/abs/2603.19312), 2026, which is small enough
to train on one GPU).

## Predicting video with the actions { #wam }

Demonstrations are scarce, and video is abundant but records no actions. Two
ideas connect them. The first infers the missing labels: a latent action model
compresses the change between two consecutive frames into a small code, and
the codes then serve as actions for pretraining
([LAPA](https://arxiv.org/abs/2410.11758), 2024, which matched a leading policy
with about 30 times less pretraining compute). The second trains the policy to
predict future video as well as actions, so that video contributes to the same
network. We refer to a model of this second kind as a world-action model.
[DreamZero](https://arxiv.org/abs/2602.15922) (2026) starts from a pretrained
video generator and produces the future frames and the action chunk together,
and NVIDIA's [GR00T 2](https://research.nvidia.com/labs/gear/gr00t-2/)
(November 2026) is the released form of the idea. In NVIDIA's arrangement,
GR00T 2 is the fast layer, and a larger reasoning model above it divides a long
task into steps.

<figure class="fig" data-figure="aux">
<figcaption>Each observation is 12 numbers, of which a two-dimensional state
determines the expert's action and the rest change at random. The brass curve
is the error of a policy fitted to the labeled demonstrations alone. The blue
curve first uses unlabeled video to find the directions of an observation that
predict the next one, and fits the policy in those. Both are linear and solved
exactly, and each curve is an average over 12 random problems.</figcaption>
</figure>

With five demonstrations, the policy trained on demonstrations alone is no
better than a constant action (an error of about 100%), and the policy that
also predicts video has an error of 20%. The prediction task identifies the state,
because the random part of an observation predicts nothing, and the few
demonstrations then only have to relate that state to the action. The advantage
disappears when demonstrations are plentiful, and with too little video the
prediction task finds the wrong directions and makes the policy worse.

Several groups report the corresponding result on robots, in which removing the
prediction objective lowers the success of the policy
(e.g., [GR-1](https://arxiv.org/abs/2312.13139) and
[Fast-WAM](https://arxiv.org/abs/2603.16666)). Whether the model should also
generate the future while it acts is not settled. Fast-WAM omitted this step at
run time with little loss, and [Long-WAM](https://arxiv.org/abs/2610.10528)
later reported a dynamic task on which doing so failed in all 20 trials. The
comparison with policies that predict nothing is also open, since the published
ones were run by the authors of the world-action models. GR00T 2 is described
in a company report, and its code had not been released when this page was
written.

## The model as the evaluator { #evaluation }

The most recent use of a world model is to stand in for the road. In March
2026, comma.ai released [openpilot 0.11](https://blog.comma.ai/011release/),
whose driving policy was trained entirely inside a learned simulator of driving
video. By the company's own account, this is the first such policy shipped to
users. Wayve and Waymo describe generative simulators that they use to evaluate
driving policies, in announcements that give no measurements. The question for
either use is whether the model ranks two policies in the same order as the
real world does.

<figure class="fig" data-figure="rank">
<figcaption>Each dot is one imagined rollout of a policy, teal where the
evaluator judged it a success. The evaluator's judgment of each rollout is
correct with the stated accuracy. The blue frame marks the policy that it
prefers in the current trial. The chart is the exact probability that the
preferred policy is the better one.</figcaption>
</figure>

An evaluator that is right about 70% of rollouts ranks two policies that
differ by 15 points correctly in 75% of trials with 60 rollouts each, and
needs about 230 rollouts each to reach 90%. A perfect evaluator reaches 95%
with 60. An inaccurate evaluator is therefore still useful, provided that its
errors are unbiased and that rollouts are cheap. The measured evidence comes
from robot arms. Google DeepMind compared a video model's verdicts with
[more than 1,600 real trials](https://arxiv.org/abs/2512.10675) and found that
it ranked policies in nearly the same order as the robot did, while predicting
success rates that were too low. An evaluator can therefore order policies
without estimating how often they succeed. A
[2026 study](https://arxiv.org/abs/2607.02642) of 324,000 paired rollouts found
that the quality of an evaluator depends on long rollouts that remain faithful
to the actions, and not on how realistic its frames appear.

## Where the field is now

The term "world model" currently names four different objects, and you should
establish which one a paper means. The first is an action-conditioned dynamics
model used for control (Dreamer, TD-MPC2, V-JEPA 2). The second is an
interactive video generator that can be steered frame by frame (e.g.,
[Genie 3](https://deepmind.google/discover/blog/genie-3-a-new-frontier-for-world-models/)
and GAIA). The third is a generator of video or 3D scenes with no action input.
The fourth is the world-action model, which is a policy that also predicts
video. A vision-language-action model such as π0.5 is none of these, since it
maps observations to actions and predicts no future observation. Whether the
generators have learned physics is disputed:
[Kang and colleagues](https://arxiv.org/abs/2411.02385) found that video models
trained on simulated collisions were accurate within their training
distribution and imitated the nearest training example outside it.

Most of the current effort is in manipulation, where the world model has moved
inside the policy. Its best-supported use there is as a training objective,
followed by the evaluation of policies and the generation of training data.
Planning by search through imagined futures, which is the use that the first
half of this page describes, is the least common on arms, because it takes
seconds per action. The laboratories are divided. NVIDIA, 1X, and AgiBot build
world-action models, and the leading models of Physical Intelligence and Google
DeepMind are policies under a language model. The table lists what the slow
layer and the fast layer are in several of these systems.

| System | Slow layer | Fast layer | What passes between them | Predicts the future |
|---|---|---|---|---|
| [GR00T N1](https://arxiv.org/abs/2503.14734) (2025) | Vision-language model at 10 Hz | Action generator, chunks played at 120 Hz | Internal features | No |
| [π0.5](https://arxiv.org/abs/2504.16054) (2025) | The same model, writing a subtask | The same model, chunks played at 50 Hz | A subtask in words | No |
| [Gemini Robotics 1.5](https://arxiv.org/abs/2510.03342) (2025) | A separate reasoning model | Vision-language-action model | Instructions in words | No |
| [Helix 02](https://figure.ai/news/helix-02) (2026) | Vision-language model | Policy at 200 Hz over a learned joint controller at 1 kHz | Internal features | No |
| [π0.7](https://arxiv.org/abs/2604.15483) (2026) | A language policy and an image generator | Vision-language-action model | A subtask and an image of the goal | One goal image |
| [GR00T 2](https://research.nvidia.com/labs/gear/gr00t-2/) (2026) | An external reasoning model | World-action model, about one chunk per second over a 50 Hz tracker | Step text and marks on the camera image | Yes |

On the road, the reproducible results are narrower than the announcements. The
large driving companies present learned simulators mostly as demonstrations,
and none has published how well its simulator ranks policies against the road.
In the air, learned latent models have helped where the difficulty is
perception and memory (e.g., racing from pixels). They have not improved on a
physical model with a residual for accuracy, and the fastest racing drone is
still trained without a world model. Every aerial world model that we found
from 2025 and 2026 was trained in a simulator. The manipulation models have
barely reached flight: π0 has flown once, after fine-tuning on about 270
demonstrations, and the open datasets on which these models are pretrained
contain no flight. We found no comparison of a learned world model with a
residual model on the same quadrotor, and no measurement of how well a
reconstructed scene ranks flight policies. Both are within reach of a project
in this course.

Several well-known repositories (e.g., DIAMOND, IRIS, DINO-WM, OpenVLA, and
Octo) are no longer maintained. The projects below were active in late 2026.

| Project | What it provides |
|---|---|
| [TD-MPC2](https://github.com/nicklashansen/tdmpc2) | A latent model with planning for state-based control, trainable on an 8 GB GPU |
| [DreamerV3](https://github.com/danijar/dreamerv3) and [r2dreamer](https://github.com/NM512/r2dreamer) | The reference pixel-based agent and its maintained PyTorch version |
| [Robotic World Model](https://github.com/leggedrobotics/robotic_world_model) | Policies and learned dynamics trained together inside Isaac Lab |
| [stable-worldmodel](https://github.com/galilai-group/stable-worldmodel) and [LeWorldModel](https://github.com/lucas-maes/le-wm) | A small JEPA with data collection, training, and planning |
| [V-JEPA 2](https://github.com/facebookresearch/vjepa2) | Pretrained video encoders to place under a small dynamics model |
| [LeRobot](https://github.com/huggingface/lerobot) | One dataset format and training command for small policies, vision-language-action models, and world-action models |
| [openpi](https://github.com/Physical-Intelligence/openpi) | The π0 and π0.5 weights, which can be fine-tuned on a 24 GB GPU |
| [Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T) | The GR00T N1 models, with fine-tuning on Isaac Lab data |
| [NVIDIA Cosmos](https://github.com/NVIDIA/cosmos) | Open video world models, which require a university cluster |
| [MPPI-Generic](https://github.com/ACDSLab/MPPI-Generic) | The Georgia Tech sampling planner as a GPU library |

The π0 and GR00T weights are released under their own model licenses, which
are more restrictive than the licenses of the code.

Most of the core reading is free. We suggest chapter 8 of Sutton and Barto's
[Reinforcement Learning](http://incompleteideas.net/book/the-book-2nd.html) for
planning with a learned model, Murphy's
[Reinforcement Learning: An Overview](https://arxiv.org/abs/2412.05265) for the
path from Dyna to latent models, and the 2026 survey
[World Model for Robot Learning](https://arxiv.org/abs/2605.00080) for the
current state.
