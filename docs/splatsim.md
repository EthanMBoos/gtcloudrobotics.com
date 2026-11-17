---
icon: lucide/scan-line
hide:
- toc
---

# splatsim

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/splatsim){ .md-button }

**splatsim** replays a drone's flight inside a Gaussian splat of the place it
flew through and scores the replay against the log. A Gaussian splat is a 3D
scene stored as millions of small colored blobs fitted to photos of a real
place, so a render of it looks like the place. The prototype covers aerial
drones with one camera.

The point is to replay with something changed: the same moment from another
height, or a different detector run on both the logged and the rendered frame.
Whether such a render can be trusted is the open research question. This is
the most research-oriented track.

```text
flight log (MCAP) -> export -> refine poses -> train splat -> replay
                                 (COLMAP)       (3DGRUT)        |
                                                                v
                                              render at every logged pose
                                                                |
                                                                v
                                           score against the logged frame
```

## Four steps

Export reads the camera frames, lens, and poses out of an MCAP flight log into
a folder. Refine runs COLMAP with the log's poses as priors, because a drone's
own GPS and gimbal estimate is too coarse to train on. Train fits a splat to
the frames with NVIDIA's [3DGRUT](https://github.com/nv-tlabs/3dgrut). Replay
renders the splat at every logged pose with the logged lens and scores each
render against the logged frame.

```sh
# Frames, lens, and poses out of the logs of one scene
uv run python -m splatsim.flightlog export data/street \
  data/pivot/orbit_low.mcap data/pivot/orbit_high.mcap

# Replay another flight of the same scene, with 3DGRUT's Python
python /abs/splatsim/src/splatsim/replay.py \
  /abs/runs/street/RUN/ckpt_last.pt /abs/data/street-loop /abs/runs/replay-loop
```

Replay writes one PNG per frame and a `scores.csv` with PSNR, SSIM, and LPIPS.
`--shift X Y Z` moves every camera by that many meters for views the drone did
not fly. Those frames have no logged frame to compare with, so they are not
scored.

The test data is
[PIVOT-mcap](https://huggingface.co/datasets/Voxel51/PIVOT-mcap), a public set
of drone flights that carries both the drone's own poses and poses solved
offline by COLMAP.

## What we have measured

Everything so far is on one PIVOT scene, a street 52 m across, and each figure
is one run.

A splat trained on six flights scores 23.0 dB on held-out frames of those
flights and 12.6 dB on a seventh flight through the same street. The second
number is an unusable image. A splat replays the flights it was built from and
fails on another one, which is the main finding so far. Adding the seventh
flight to the training set brings its replay to 18.5 dB.

The drone's own poses cannot train a splat as they are. COLMAP, seeded with
them, lands within 6 cm of the offline solution and trains as good a splat as
the reference poses. It takes about two hours on 8 CPUs for 661 frames.

splatsim used to render splats in NVIDIA Isaac Sim. On the same splat Isaac Sim
scored 22.2 dB where 3DGRUT's own renderer scored 31.7 dB, and it took about
100 times longer per frame. Replay now uses 3DGRUT's renderer, and the Isaac
Sim base became [isaacdrones](isaacdrones.md).

## Where to work

Each of these was probed for a few hours to see whether it holds a hard wall,
an easy win, or an open question:

- a trust score per rendered frame, predicted from camera geometry alone and
  checked against measured PSNR;
- which extra flight buys the most replay quality: a second traverse, the same
  one reversed, or an orbit;
- pose and lens optimization inside 3DGRUT, to replace the two hours of COLMAP;
- a task score beside the image scores: run a detector on the logged and the
  rendered frame and compare what it finds;
- a viewer that shows the logged frame beside the render along a timeline; and
- a reader for ROS 2 logs, then a log from our own drone.

## Current limits

Export and refine need only a CPU and run on Linux or macOS. Train and replay
need Linux, an NVIDIA GPU with CUDA, and an installed 3DGRUT. Our only such
machine is Georgia Tech's PACE ICE cluster.

The log reader covers one convention: Foxglove protobuf messages as PIVOT
writes them. PIVOT's frames are sharp stills at 10 Hz, so motion blur and
rolling shutter are untested. There is no simulator in the repository, and no
physics, lidar, or radar.

!!! note "Read the engineering docs"

    Start with the repository
    [README](https://github.com/EthanMBoos/splatsim#readme).
    [TRACKS.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/TRACKS.md)
    holds every measurement and the first step for each research track,
    [TODO.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/TODO.md)
    lists open work smallest first, and
    [PACE.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/PACE.md)
    covers running on the cluster.
