---
icon: lucide/brain
hide:
- toc
---

# flightwam

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/flightwam){ .md-button }

**flightwam** is where I am trying out learned world models on a drone. A world
model predicts what a robot will observe next from what it observes now and the
action it takes. Not currently sure what is best, so I am trying a few angles.

Most of the progress in robot learning right now is in manipulation, where arms
and humanoids are doing things in demos that nobody had seen a year ago. They
work by splitting the job between two models. A language model (system 2), which
is good at reasoning, breaks the problem down, and a world model (system 1),
which is good at motion, carries out each piece. In NVIDIA's [GR00T
2](https://research.nvidia.com/labs/gear/gr00t-2), the world model generates the
next camera frames and the next actions together, and a language model (e.g.,
GPT-6 Astra) calls it as a tool, with a sentence and points marked on the camera
image. The bet is that the world model does not need to see far into the future
or break a task into subtasks, because the language model does both.

Little of this has reached drones, and I have not found a model like GR00T 2
flown on one. The goal of this track is to fly one of these ideas on a drone in
simulation. These models produce actions a few times per second, and a drone has
to be stabilized hundreds of times per second. The model therefore outputs
waypoints, and a conventional controller tracks them.

I want to know which techniques from the manipulation boom carry over to aerial
drones. Some things to try.

- fine-tune a world action model (e.g., GR00T 2) on simulated flights, with and
  without the predicted frames, to see whether predicting video helps a drone;
- fine-tune on 10, 100 and 1,000 flights, and on few scenes against many, to see
  how much data it takes;
- have a language model command a flight skill with points on the image, and
  decide what the drone does while the language model's last answer goes stale;
- plan in a learned feature space (e.g.,
  [V-JEPA 2](https://arxiv.org/abs/2506.09985)).

I expect the main difficulty to be data. The progress in manipulation seems to
follow the amount and variety of data more than the architecture:
[π0](https://arxiv.org/abs/2410.24164) was trained on about 10,000 hours of
robot demonstrations, and GR00T 2 on about 400,000 hours of human video and more
than 30,000 hours of gripper and robot demonstrations. We do not have the
resources to collect anything like this for drones, so the follow-on question is
what we can do with much less.

The data will come from [isaacdrones](isaacdrones.md). My rough estimate is 200
hours of simulated flight, or about 20,000 short flights, which is about 70 GPU
hours of rendering. isaacdrones flies one scripted line per run today, so it
needs these first:

- many flights per launch, each on a new route;
- velocity commands, recorded with every image;
- a writer that saves flights directly, without ROS 2;
- collisions, so that a flight can fail;
- tasks with a goal and a success check;
- many scenes, with some held out for testing.

!!! note "Docs"

    The [README](https://github.com/EthanMBoos/flightwam#readme) lists the
    directions and what to read. The
    [World Models intro](world-models/intro.md) covers the background.
