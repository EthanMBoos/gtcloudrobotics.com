---
icon: lucide/clock
---

# Time Alignment

Every sensor reading on a robot is implicitly a pair: *what* was measured, and *when*. The "what" gets all the attention — engineers spend years calibrating sensors and tuning estimators against it. The "when" is where the silent bugs live. If two modules disagree on what "now" means by even a few tens of milliseconds, the data they produce no longer describes the same world, and downstream code that combines them is making decisions about a scene that never existed. **Time alignment is the discipline of making sure that gap stays closed**, across every clock, timestamp, and processing delay on the robot. Get it right and your sensor fusion, state estimation, and control loops can trust their inputs; get it wrong and every layer above silently produces confident, wrong answers.

The trickiest of these bugs live *inside a single robot*. The autopilot, mission computer, perception nodes, and sensor firmware each have their own clocks; none of them agree, none of them are wrong in their own frame, and a downstream consumer that treats two modules' timestamps as the same instant is how most fusion bugs get written. Cross-link alignment between robots or between a robot and a ground station is a related but separate problem with well-established distributed-systems answers (NTP-style ping-pong, PTP over the air, minimum-RTT filtering) — it's not where the silent bugs usually hide, so this lesson focuses on the on-robot case.

---

## 1. Pick One Canonical Clock

The intuitive mental model — "my robot has a clock, I'll just call `now()`" — is wrong before you've written the second line of code. There is no "the robot's clock." A typical platform has at least four or five independent clocks, each started at a different instant, each disciplined however its firmware decided, each drifting at its own rate, and none of them authoritative.

![Robot Clock](assets/images/robot_clock.png)

The bug that costs you a flight is the one where two modules both stamp their data with what they each call "t = 12.450" and a downstream fusion node treats those as the same instant. The lidar detection and the camera detection at "t = 12.450" might be 80 ms apart in reality, and the perception stack happily projects the lidar points into a camera frame that was captured during a different part of the maneuver. The fused output looks reasonable. It's wrong.

The discipline that fixes this is the same boundary discipline from [system design §2](system-design.md#2-interfaces-are-the-real-architecture) and [the adapter pattern in progressive testing](progressive-testing.md#5-dont-let-hardware-patches-poison-the-core): **treat the timestamp as part of the sensor reading, and convert it at the adapter.** Every message that enters the system from a module with its own clock gets re-stamped at the adapter into a single canonical robot time. Downstream code only ever sees canonical time. No fusion node ever asks "whose clock is this?" because the answer is always the same.

---

## 2. Reconcile By Measured Offset, Not By Hope

Re-stamping at the adapter only works if you actually know the offset between each module's clock and your canonical one. The wrong way is to assume the offset is zero, or to measure it once at boot and call it done. Offsets drift — at 20 ppm, a clock loses or gains a millisecond every minute, so a "good enough" boot-time alignment is wrong by tens of milliseconds within an hour.

The standard pattern, which MAVLink's `TIMESYNC` and PTP's two-step both implement, is a continuous ping-pong:

```
companion → autopilot: "here is my t_cc = T1"
autopilot → companion: "I received it at my t_ap = T2, replying at my t_ap = T3"
companion receives reply at t_cc = T4

half_rtt = ((T4 - T1) - (T3 - T2)) / 2
offset_ap_to_cc = T2 - (T1 + half_rtt)
```

Run this every second, low-pass filter the result, and you have a continuously-updated estimate of "autopilot time minus companion time" that tracks drift. Every autopilot message arriving on the companion gets its timestamp converted by adding that offset. Done correctly, the canonical frame stays accurate to the jitter of the link itself — sub-millisecond on a direct UART, low-millisecond over USB, microseconds on a PTP-capable Ethernet.

The same idea applies to every other module. The camera's onboard timestamp gets reconciled by triggering the camera off a known signal and measuring the offset between "trigger fired" and "frame metadata says it fired." The lidar gets reconciled by wiring its PPS input to the GPS PPS and treating the GPS-disciplined PPS edges as ground truth. Each module gets its own offset estimator; each adapter applies its own correction.

A few things that catch people:

- **The offset estimator hasn't converged at boot.** The first several seconds of data after startup are stamped with whatever the initial guess was. Either gate publishing until the offset is stable, or stamp each message with a "clock-source confidence" flag so downstream code can decide whether to use it.
- **Re-stamping loses provenance.** Once you convert to canonical time, the original timestamp is gone unless you keep it. Always carry both: the original (in the source clock) and the converted (in canonical). Debugging a sync bug without the original timestamps is nearly impossible.
- **Don't re-stamp at publish.** A planner that subscribes to a pose, runs for 30 ms, and publishes a trajectory stamped with `now()` has thrown away the information about *when the pose it used was measured*. Carry the source timestamp through; stamp the publish time separately if you need it.

**Characterization.** Online, continuous, analytical — no bench tests, no ML, no stored per-unit calibration. The ping-pong loop runs at ~1 Hz forever and the low-pass filter tracks slow drift while rejecting RTT spikes. Per-unit oscillator variance is absorbed automatically: the algorithm doesn't care whether module A's crystal drifts at +18 ppm and module B's at -23 ppm, because it only tracks the *running difference* between them. The only design choices are the filter constants (smoothing α, convergence threshold) and the boot-time gate that delays publishing until residual variance drops below threshold — a few seconds of convergence after startup is the practical cost.

But clock reconciliation is only half of what each adapter has to do. The other half — recovering *when the measurement actually happened*, not just when its message arrived — is the harder problem, and the one most teams skip.

---

## 3. A Detection Is Older Than Its Timestamp Says

Even after the clocks agree, the timestamp on a detection rarely tells you what you think it does. A camera detection arriving at canonical t = 12.450 is not saying "an object was at this location at t = 12.450." It's saying "we finished computing a detection at t = 12.450, about a state of the world that existed some time earlier" — and *how much earlier* is the difference between a controller that dodges the obstacle and one that reacts to where the obstacle used to be.

Every sensor that produces a detection has a pipeline, and every stage of that pipeline costs time:

![Detections](assets/images/detections.png)

That total is not theoretical. A detection that the network just received "right now" is describing a world that existed somewhere between 80 ms and 300 ms ago, depending on the model and the lighting. If a controller takes the published timestamp at face value — even with perfectly reconciled clocks — it's reasoning about an obstacle's location that's already wrong by however far the obstacle moved during the pipeline.

The discipline that fixes this is to put two timestamps on every message:

- **`t_measure`** — when the world was in the state this message describes. The exposure midpoint for a camera detection; the start-of-scan time for a lidar frame; the GPS fix epoch for a position update.
- **`t_publish`** — when this specific message was emitted into the system. Useful for liveness checks ("haven't seen a detection in 200 ms"), network debugging, and ordering — but not for reasoning about *the world*.

Each adapter computes `t_measure = t_publish - sum_of_known_stage_latencies`. The latencies aren't guesses — they're measured for each pipeline and recorded somewhere the adapter can read. A camera that runs a 20 ms exposure followed by a 60 ms detection step publishes its detection with `t_measure = t_publish - 0.080`. If a stage's latency varies meaningfully — for example, a detection model whose inference time depends on the number of objects in the scene — the adapter records the actual stage latency per-frame from a wall-clock measurement of that stage. If a measurement time can't be recovered exactly, record an uncertainty band, not a confident-looking guess.

!!! note "Spinning lidar: per-point, not per-message"
    A spinning lidar's points are spread across the scan — on a 15 m/s UAV, the platform moves 1.5 m during one 100 ms scan, so points acquired late in the scan are reported in a body frame the robot has already left. Motion-compensating the scan (re-projecting each point using the IMU trajectory across the scan window) is part of the adapter's job, not the planner's.

Once `t_measure` exists on every message, downstream code can finally do honest math. A planner can extrapolate an obstacle's track forward from `t_measure` to "now" instead of treating a 200 ms-old position as current. A controller can decide whether a detection is fresh enough to act on. A logger can replay events in the order they actually happened in the world, not in the order they happened to arrive on the bus.

**Characterization.** Three layers, each measured directly:

- *Software stages you control* — instrument with `t_in`/`t_out` per node; the adapter sums them. Online, per-frame, tracks load variation for free. ROS 2 and MAVLink have hooks; add them if yours doesn't.

- *Sensor-internal stages (exposure, readout, ISP)* — sealed, so you can't probe. Either bench-flash an LED and histogram the arrival latency, or trust the sensor's embedded timestamp once its clock is reconciled (§2). In practice both: embedded for the bulk, a bench offset for whatever the firmware misses.

- *Per-unit variance* — ignorable for sensors (same-model units rarely differ by >5%, so a per-model bench number suffices). **Actuators are the opposite:** motor response varies unit-to-unit, which is why PX4 stores motor time-constants per *vehicle*. Sensors: per-model. Actuators: per-unit, at commissioning.

No ML — the structure is fixed; direct instrumentation beats any learned estimator.

---

## 4. Reaction Loops Have An End-To-End Budget

Once every message carries `t_measure`, the next question is *how stale is the freshest information the controller can possibly act on?* Even with no bugs and no buffering anywhere, every closed-loop reaction has a floor on its latency: light has to hit the sensor, the pipeline has to run, the planner has to react, the controller has to compute, and the actuator has to physically respond.

A realistic obstacle-avoidance reaction loop on the same UAV:

| Stage | Latency |
| --- | --- |
| Photons → camera detection ready (from §3) | 80–300 ms |
| Detection → planner (transport + queueing) | 5–20 ms |
| Planner inference (5 Hz nominal) | 20–100 ms |
| Trajectory → controller (transport) | 1–10 ms |
| Controller computation | 1–5 ms |
| Controller → ESC / servo (transport + actuation) | 5–20 ms |
| Motor / aerodynamic response (thrust → measurable acceleration) | 50–200 ms |
| **Total: photons → measurable response** | **~160–650 ms** |

A UAV moving at 15 m/s covers between 2.4 m and 9.8 m of forward distance during that window. That number is the *minimum* standoff distance the system can guarantee against a static obstacle that appears suddenly. Anything closer than that is past the loop's ability to react, no matter how clever the planner is.

This is what makes pipeline latency a system-design problem, not just a perception problem. Three concrete consequences fall out:

1. **The standoff envelope is set by the slowest stage, not the fastest.** Doubling the controller's rate from 200 Hz to 1 kHz buys you ~4 ms. Halving the detection model's inference time from 200 ms to 100 ms buys you 100 ms. The leverage is always in whichever stage dominates the budget, and that stage is almost never the controller.
2. **The planner must extrapolate, not interpolate.** The freshest detection is already 100–300 ms old; the controller will act on it 30–100 ms later still. A planner that hands the controller a trajectory through "where the obstacle is now" is actually sending it to where the obstacle *was*. Trajectories should be planned against the obstacle's projected position at the actuation moment, using `t_measure` and a tracked velocity.
3. **Reaction-time bugs hide in the slowest pipeline.** If perception is the bottleneck at 250 ms and someone shaves the planner from 80 ms to 20 ms, the total reaction time barely changes — but a casual reviewer might claim "we halved planner latency" as if the robot were now twice as responsive. Budget the whole pipeline, not the stage you happened to touch.

The rule that ties this back to [system design's freshness budgets](system-design.md#3-rate-latency-and-freshness-budgets): every consumer publishes the maximum measurement age it can tolerate, every producer publishes its actual end-to-end latency, and a check at integration time confirms the budgets close. When they don't close, the answer is either to reduce the slowest stage's latency or to widen the standoff envelope — never to pretend the loop is faster than the math says it is.

**Characterization.** *Compose* the budget; don't measure it end-to-end. A synthetic-obstacle test that triggers a known event and times the response sounds rigorous, but it requires a controlled test environment to do meaningfully and the answer just matches the sum of the §3 per-stage measurements anyway. Add the per-stage software and sensor numbers from §3, plus the actuator-response number from airframe commissioning (motor time-constants on a UAV, drivetrain response on a ground vehicle), and you have the budget.

What you *do* measure across the whole loop is the **distribution**, and you do it from logged flights, not bench tests. Over a representative mission, log every stage's `t_in`/`t_out`, sum per frame across all stages, and produce a histogram of the total. The **99th percentile** is your design number — not the median. The median tells you what usually happens; standoff distances have to survive the bad frames, not the typical ones. A pipeline whose median latency is 200 ms and whose 99th-percentile is 500 ms has a 500 ms budget, and pretending otherwise is how you get a collision on the one frame the GPU stalled.

Re-characterize whenever you change a detection model, swap a sensor, refactor a node's hot path, or move to a different airframe variant. Re-log on a schedule even when nothing changed, because compute regressions — background services waking up, thermal throttling kicking in mid-flight, OS upgrades quietly adding kernel work — silently widen the tail of the distribution. Treat the 99th-percentile budget as a CI metric: if a software change widens it, you've regressed even if the median didn't move.

---

## 5. Characterize Cold, Loaded, Long, And Live

The Characterization blocks in §§2–4 say *what* to measure (clock offsets, per-stage latencies, the end-to-end distribution). They don't say *under what conditions*, and the answer is "all of them, in a specific order, because each condition reveals a different class of bug." Bench numbers from a powered-up but idle robot are a starting point, not a finish line — every layer of realism above will quietly invalidate them.

**Stage 1: Cold, composed.** Power the robot on, run nothing else, and measure each stage in isolation. The camera adapter alone with `t_in`/`t_out` instrumentation. The detection model alone, against synthetic frames. The autopilot link's offset estimator left running for a minute. The lidar pipeline alone against a still scene. Sum the per-stage medians and 99th-percentiles into a composed end-to-end budget. This number is the *floor* — the latency the robot can hit when nothing else is happening, which is the latency the robot will never actually see in flight. It's still useful: a stage whose cold characterization already eats half the budget is a stage you have to fix before any later test will be meaningful.

**Stage 2: Loaded — the full system under realistic conditions.** Now turn everything on. The GPU saturated with detection inference. The planner, controller, and logger threads all consuming their share of CPU. Every sensor streaming at full rate. The autopilot serial link carrying parameter updates and telemetry alongside TIMESYNC, at flight-realistic bandwidth. The motors spinning at flight-realistic current draw — this one matters more than it sounds, because ESC switching currents couple into nearby buses through ground noise and can shift serial timing by milliseconds. Re-run the same per-stage characterization with all of this happening simultaneously. Two things will happen, and both are normal: medians will drift up a few percent, and tails will drift up *a lot*. A 200 ms median that becomes 220 ms loaded might see its 99th percentile jump from 280 ms to 600 ms. The tail is what the budget has to absorb (§4), so this is the test that produces your real number. If the loaded 99th percentile blows past what the standoff envelope tolerates, the fix isn't "ignore it because the median looks fine" — it's "find the stage whose tail expanded under load and figure out why."

**Stage 3: Endurance — what fails after hours.** Leave the loaded system running for the length of a real mission, then for longer than any single mission. Log the same end-to-end budget metric continuously. The failure modes that show up here aren't subtle once you know to look for them:

- *Thermal throttling* kicks in after 20–40 minutes of sustained compute and widens every compute-bound stage.
- *Memory leaks* raise OS scheduling latency as swap pressure builds, even before anything OOMs.
- *Disk I/O slows* once log files grow past a few GB, if any stage touches disk synchronously.
- *Oscillator drift accumulates* as crystals warm up — and warm differently in different parts of the robot, so the offset estimator from §2 has more work to do as the run gets longer.
- *DDS/Zenoh discovery state grows*, adding overhead to the publish path.
- *Kernel socket buffers fill* if any consumer fell behind once and never recovered.

The acceptance criterion for this stage is monotonic stability: if the tail is creeping upward over the run, the robot has a leak somewhere and the budget will eventually fail to close. Cold and loaded characterization will not catch any of this — it has to be measured over time.

**Stage 4: Runtime monitoring — catching failures while the robot is alive.** Once the robot is deployed, the same metrics that produced the characterization become health signals. Every adapter reports its own latency and timestamp statistics at a slow rate (1 Hz is fine), and three runtime watchdogs catch the failures the prior stages told you to expect:

- *Latency tail.* Alarm when the running 99th-percentile crosses some fraction of the §4 budget — *before* the budget is actually violated, so degraded modes have time to engage.
- *Staleness.* Alarm when `now() - t_publish` exceeds the producer's expected period by more than a small multiple. The sensor has stopped publishing or its driver has hung.
- *Offset-estimator health.* Alarm when the §2 offset estimator's residual variance grows. A module's clock has started behaving differently — drift, glitch, failing crystal — and the rest of the stack needs to know before its outputs go bad.

The alarms feed into the same monitor pattern as any other safety invariant: degrade gracefully, log everything, prefer "fail loud" over "fail wrong."

A robot that has been through all four stages doesn't have a *fixed* characterization — it has a known healthy operating envelope and a runtime check that catches departures from it. Skipping any of the four stages has a specific cost. Skip stage 2 and bench numbers will get you killed by load. Skip stage 3 and the robot that demoed perfectly will fail on the first long mission. Skip stage 4 and a slowly-failing sensor will produce confidently wrong outputs until something obvious breaks downstream.

---

## 6. The Middleware Owns Time, Or You Do

Everything we've covered — clock reconciliation, measurement-time recovery, end-to-end budgets — has to live somewhere in the stack. The framework you pick decides which pieces are handed to you and which you build yourself. The two extremes:

![Time](assets/images/time.png)

The chart shows what each side *offers*. What it doesn't show is where production teams end up after the §4 budget refuses to close.

**ROS 2 gives you scaffolding, not a solution.** The `/clock` abstraction and `use_sim_time` are genuinely useful — for sim and replay, they hand you a pluggable time source that the whole node graph respects. But production clock discipline (getting the hardware clocks to agree in the first place) is an OS-level concern: you configure PTP or NTP yourself, outside ROS, and ROS reads whatever the system clock says. The `Header.stamp` convention exists, but nothing enforces it — a node that stamps with receipt time instead of measurement time compiles and runs silently, and that's how most fusion bugs in ROS-based systems get written. `tf2` and `message_filters::ApproximateTimePolicy` are real alignment primitives, but they solve the problem *after* the timestamps are correct, not *before*.

**The transport layer is where the budget usually breaks.** Every ROS 2 message crosses a DDS serialization boundary, and every node-to-node hop pays for it. Profiling the ROS 2 stack shows [up to 50% latency overhead](https://arxiv.org/pdf/2101.02074) compared to calling the DDS layer directly; under load, with lidar and camera streams saturating the same DDS domain, the tail latency is what kills you. The pattern that production teams converge on is to bypass ROS 2 on the latency-critical path while keeping it for everything else. At the [Indy Autonomous Challenge](https://www.rti.com/blog/the-indy-autonomous-challenge-achieving-extreme-performance-with-ros-2), the winning team (TUM) ran a [lidar driver rewritten to call the DDS API directly](https://www.electronicdesign.com/markets/automation/article/21258792/real-time-innovations-rti-ros-and-dds-making-the-most-out-of-your-software-framework) beneath ROS 2, cutting transport latency by up to 90% without breaking compatibility with the rest of the stack. A more recent study on a production L4 vehicle running Autoware.Universe replaced intra-process DDS with a [shared-memory transport (SIM)](https://arxiv.org/pdf/2510.11448) and saw perception-to-decision latency drop from ~522 ms to ~290 ms — enough to shorten emergency braking distance by four meters at 40 mph. These aren't exotic workarounds. They're what closing a real §4 budget looks like.

**Bare-metal (MAF) pays the opposite tax.** Clocks are constructor arguments, `t_measure` is a required field rejected at the authority boundary if missing, and single-writer is enforced at link time — the time bugs that ROS lets you write silently won't compile here. What it costs you: no `tf2`, no `message_filters`, no bag replay, no package ecosystem. Every alignment primitive is yours to build, and the tooling gap is real. Teams that choose this path get enforcement and latency; they pay in integration time and in every convenience tool they have to write or forego.

**Which trade?** If the critical reaction loop has to close a tight §4 budget — collision avoidance on a fast platform, anything safety-critical — bare-metal earns its keep. If 50–100 ms of distributed overhead is fine and the ecosystem matters more, ROS is the right answer. In practice, most production systems end up in the middle: ROS at the edges for tooling, visualization, and logging; bare-metal or a thin shared-memory transport on the latency-critical path from perception through control. The seam between them is where re-stamping into the right time model has to be most explicit, because crossing it means crossing time models too.

---

## Assignment

!!! warning "Assignment under construction"
    This stub is a placeholder and hasn't been written yet. Check back later for content.
