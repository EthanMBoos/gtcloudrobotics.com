---
icon: lucide/globe
hide:
- toc
---

# World Models

No repo and no code yet. I also know less about this than the other areas, so
the first job is reading the newest papers and seeing how much of it we can
reproduce.

The idea is a drone in two layers: a fast learned model at the bottom that
predicts what the camera sees next and picks actions, and an LLM on top that
tells it what to do (go there, hold, orbit, land). NVIDIA's GR00T 2 does this
for arms and humanoids. Nobody has shown it on a drone yet.

To start, get [LeWorldModel](https://github.com/lucas-maes/le-wm) training on
PACE. Then fly a simulated drone in [isaacdrones](isaacdrones.md), log the
camera and commands, and train the same model on that. Check how far ahead it
predicts, and whether it still works on a flight it never saw.

After that, try planning to a goal image, or hook the skills up to an LLM as
tools.
