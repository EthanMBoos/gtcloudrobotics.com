---
icon: lucide/scan-line
hide:
- toc
---

# splatsim

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/splatsim){ .md-button }

**splatsim** replays a drone's flight inside a Gaussian splat of the place it
flew through and scores the replay against the log. A splat is a 3D scene fitted
to photos of a real place, so a render of it looks like the place. It handles
aerial drones with one camera for now.

The goal is to replay with something changed, like the same moment from another
height or with a different detector. We don't know yet how far a render like
that can be trusted, so this is the most research-heavy track.

```text
flight log (MCAP) -> export -> refine poses -> train splat -> replay
                                 (COLMAP)       (3DGRUT)        |
                                                                v
                                              render at every logged pose
                                                                |
                                                                v
                                           score against the logged frame
```

## Run it

```sh
# Frames, lens, and poses out of the logs of one scene
uv run python -m splatsim.flightlog export data/street \
  data/pivot/orbit_low.mcap data/pivot/orbit_high.mcap

# Replay another flight of the same scene, with 3DGRUT's Python
python /abs/splatsim/src/splatsim/replay.py \
  /abs/runs/street/RUN/ckpt_last.pt /abs/data/street-loop /abs/runs/replay-loop
```

Replay writes one PNG per frame and a `scores.csv` with PSNR, SSIM, and LPIPS.
`--shift X Y Z` moves every camera by that many meters to get views the drone
didn't fly. Those have no logged frame to compare with, so they aren't scored.

Test data is [PIVOT-mcap](https://huggingface.co/datasets/Voxel51/PIVOT-mcap),
a public set of drone flights.

## What we've measured

All on one PIVOT scene, a street 52 m across, one run per number.

A splat trained on six flights scores 23.0 dB on held-out frames of those
flights and 12.6 dB on a seventh flight down the same street. 12.6 dB is an
unusable image. Adding the seventh flight to training gets it to 18.5 dB.

The drone's own GPS and gimbal poses are too coarse to train on. COLMAP gets
them within 6 cm of the reference, in about two hours on 8 CPUs for 661 frames.

Isaac Sim rendered the same splat at 22.2 dB against 31.7 dB for 3DGRUT's
renderer, and about 100 times slower, so replay uses 3DGRUT.

## Things to work on

- A trust score per rendered frame, predicted from camera geometry and checked
  against PSNR.
- Which extra flight helps replay most: a second traverse, the same one
  reversed, or an orbit.
- Pose and lens optimization inside 3DGRUT, to skip the two hours of COLMAP.
- A task score: run a detector on the logged and rendered frames and compare.
- A viewer with the logged frame next to the render on a timeline.
- A reader for ROS 2 logs, then a log from our own drone.

## Limits

Export and refine run on a CPU, Linux or macOS. Train and replay need Linux, an
NVIDIA GPU, and 3DGRUT, which for us means PACE ICE.

The log reader only handles Foxglove protobuf MCAP the way PIVOT writes it.
PIVOT frames are sharp stills at 10 Hz, so motion blur and rolling shutter are
untested.

!!! note "Docs"

    [README](https://github.com/EthanMBoos/splatsim#readme),
    [TRACKS.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/TRACKS.md)
    (every measurement),
    [TODO.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/TODO.md),
    and
    [PACE.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/PACE.md)
    (running on the cluster).
