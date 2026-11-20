---
icon: lucide/scan-line
hide:
- toc
---

# splatsim

[:fontawesome-brands-github: View on
GitHub](https://github.com/EthanMBoos/splatsim){ .md-button }

**splatsim** replays a drone's flight inside a Gaussian splat of the place it
flew through, and scores the replay against the flight log. A splat is a 3D
scene fitted to photos of a real place, so a render of it resembles that place.
The pipeline exports frames and poses from the log, refines the poses, trains
the splat, and then renders it at every logged pose. Training and replay require
an NVIDIA GPU, which for this course means running on PACE ICE.

```sh
uv run python -m splatsim.flightlog export data/street \
  data/pivot/orbit_low.mcap data/pivot/orbit_high.mcap
```

The goal of this track is to replay a flight with something changed (e.g., the
same moment from another height, or with a different detector) and to trust the
result. This requires knowing how far from the captured flights a render remains
accurate, which is not yet known, and it makes this the most research-heavy
track.

The measurements so far show the size of the problem. A splat trained on six
flights of one street scores 23.0 dB on held-out frames from those flights and
12.6 dB on a seventh flight along the same street, which is an unusable image.
The work therefore begins with predicting, from camera geometry alone, how much
a rendered frame can be trusted. It then turns to which additional flights
improve replay the most, and to scoring a replay by running a detector on the
logged and rendered frames.

!!! note "Docs"

    The [README](https://github.com/EthanMBoos/splatsim#readme) covers
    everything else. Start with
    [TRACKS.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/TRACKS.md)
    for every measurement and
    [PACE.md](https://github.com/EthanMBoos/splatsim/blob/main/docs/PACE.md)
    for running on the cluster.
