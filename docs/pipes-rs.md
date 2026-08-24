---
icon: lucide/workflow
hide:
- toc
---

# pipes-rs

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/pipes-rs){ .md-button }

`pipes-rs` is a sensor processing and fusion frontend for ROS 2.
It will read cameras, lidar, radar, IMUs, and other sensors, keep their data in
time, run the heavy processing and fusion nearby, and publish the results that
the rest of the robot needs. It is not a replacement for ROS 2. It is a place
to handle the sensor-heavy work before that data reaches the wider ROS graph.

Most of the project will be written in Rust. If a useful factor-graph solver,
fusion library, vendor SDK, or GPU library is written in C or C++, we will use
it. Rewriting good libraries just to make the project entirely Rust is not the
goal.

The first work is to replay camera, lidar, and IMU data, process and fuse it,
and publish the result to ROS 2. Then increase the sensor rates and data sizes
and watch what happens to timing, dropped measurements, and the estimate. That
should help separate a fusion problem from a sensor pipeline that simply cannot
keep up.
