---
icon: lucide/globe
hide:
- toc
---

# World Models

There is no repository and no existing code, and I know less about this area
than the others. The first job is to find out what the newest papers do and how
much of it a student team can reproduce.

The idea to investigate is a robot in two layers. At the bottom, a fast learned
model predicts what the camera will see next and picks actions. On top, a
language model commands it through a few skills: go to that point, hold, orbit,
land. NVIDIA's GR00T 2 is built this way for arms and humanoids. It has not been
shown on a drone. The world models that do fly drones today are small, and few
of those papers have released code.

The first work is small. Get an open world model such as
[LeWorldModel](https://github.com/lucas-maes/le-wm) training on PACE with
its stock task. Then log camera flights of a simulated drone, with the commanded
actions, and train the same model on them. [isaacdrones](isaacdrones.md) is the
place to fly.

Then measure how many steps ahead the prediction holds, on the training flights
and on a flight the model was not trained on. [splatsim](splatsim.md) found that
a splat replays the flights it was built from and fails on another one, and a
learned model may do the same.

Once that works, try planning to a goal image, checking whether the model ranks
policies the way the simulator does, or wrapping the skills as tools a language
model can call.
