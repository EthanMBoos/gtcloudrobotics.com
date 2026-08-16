---
icon: lucide/plane
hide:
- toc
---

# UnrealArdupilot

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/UnrealArdupilot){ .md-button }

**UnrealArdupilot** gives controls engineers one place to run aircraft and boat controls in Unreal Engine with ArduPilot. It brings trim, linearization, scripted inputs, tuning, closed-loop runs, and replay into one workflow without making every experiment an Unreal or C++ task.

Unreal owns the world, clock, rendering, and collisions. A small C++ core adds the vehicle physics needed for controls work. The core also runs without Unreal, so the same model can be trimmed, linearized, tested, and compared with established solvers.

The goal is to push this setup as far as it can go for both air and water vehicles. Stock Chaos physics stays in place where it works. Targeted models replace the parts that are already known to be too simple. Verified examples show where the results can be trusted: JSBSim checks the aircraft model, while Capytaine, WEC-Sim, and published data check later boat work.

## Made for controls work

Normal use starts with a vehicle file and an experiment file, not the source tree.

```text
pick a vehicle -> choose a condition -> trim -> linearize -> run -> compare -> tune -> rerun
```

The data files hold mass, inertia, aerodynamic or hydrodynamic coefficients, actuator mappings, limits, initial conditions, wind or waves, command schedules, and ArduPilot parameters. Changing a coefficient, control mapping, test input, environment, or gain should not require changing the core or rebuilding the simulator.

Adding a genuinely new force model may still take a small C++ module. That module plugs into a fixed force-and-moment interface, so it does not require edits to the clock, logs, ArduPilot connection, experiment tools, or Unreal adapter.

Each run saves the complete setup beside labelled signals, trim results, state-space matrices, controller data, and comparisons. MATLAB or Python can load the results directly. A controls engineer should be able to copy a known passing case, change one thing, rerun it, and see exactly what changed.

Trust comes from those starting cases. The aircraft example includes hand-checked force cases, JSBSim comparisons, a saved trim point, scripted doublets, matching CLI and Unreal forces, and an ArduPilot closed-loop run. The boat path follows the same idea with flat-water balance, decay tests, wave amplitude and phase, and later comparison against engineering solvers.

## System layout

ArduPilot sees the same kind of loop it would see on a real vehicle: sensor data comes in, its controller runs, and actuator outputs go back to the simulator.

```text
ArduPilot SITL
      |
      | PWM control outputs
      v
channel map and actuator model
      |
      | surface angles, throttle, rudder and thrust
      v
C++ vehicle forces
      |
      v
Unreal / Chaos vehicle motion
      |
      | IMU, position, velocity and air/water data
      +------------------------------------------> ArduPilot SITL
```

Every step uses a fixed simulation clock. Commands, physical actuator positions, forces, moments, vehicle state, and sensor outputs are recorded together. That makes it possible to find a bad sign, unit conversion, delayed command, or unstable controller without guessing from the animation.

## Fixed-wing aircraft

The first aircraft is the [educational Aerosonde model from BYU MAVSim](https://github.com/byu-magicc/mavsim_public/blob/a8489bbc30ab9e746dccac8ac614ab2f8acac6bb/mavsim_python/parameters/aerosonde_parameters.py). It has a small set of aerodynamic derivatives, electric-motor equations, and enough published parameters to build the complete model without starting from a large flight simulator.

The C++ core calculates air-relative velocity, angle of attack, sideslip, and dynamic pressure. From that it calculates lift, drag, side force, and the roll, pitch, and yaw moments. It also models the control surfaces, throttle, propeller thrust and torque, ISA atmosphere, and constant wind.

The same function runs in two places. The command-line version integrates the aircraft without Unreal. The Unreal plugin sends its forces and moments into Chaos.

```text
                         +-> headless integrator -> trim / linearize / scripted tests
aircraft C++ model ------|
                         +-> Unreal Chaos -------> rendered flight / collisions
```

The headless path answers controls questions quickly:

```text
configure -> trim -> linearize -> excite -> compare -> replay
```

It can find a steady 25 m/s flight condition, calculate a local state-space model, run elevator or aileron doublets, and compare nonlinear motion with the linear model. Frozen-state force and moment results are also checked against a pinned JSBSim aircraft definition using the same source parameters.

After those checks pass, ArduPlane SITL closes the loop in Unreal. The simulator sends ideal IMU, position, velocity, attitude, and airspeed data through ArduPilot's JSON interface. ArduPilot returns PWM outputs for the control surfaces and throttle.

The first flight starts in the air at the trimmed condition. Takeoff, landing gear, and ground handling can wait until the flight model and controller connection work.

The aircraft checkpoint ties all of this together. Hand-calculated and JSBSim force cases need to agree. The headless model needs to trim and respond correctly to scripted controls. A state tested in the CLI and Unreal needs to produce the same model forces. ArduPlane then needs to stabilize the aircraft from an air start, and the saved command sequence needs to replay tick by tick.

## Boat simulation

The first boat setup uses Unreal Water, Unreal Buoyancy, and one Chaos rigid body. A shared wave setup controls the visible surface and the water-height queries used by buoyancy. ArduPilot Rover in boat mode commands propulsion and steering.

```text
wave height / period / direction
              |
              v
      Unreal Water surface
         |             |
         |             +-> rendered water
         v
  buoyancy queries
         |
         v
Chaos boat <--- thrust and rudder <--- ArduPilot boat control
```

This baseline gets the complete loop running: the boat floats, reacts to a regular wave, follows a heading or waypoint, and collides with a dock. It also exposes the stock model's limits. Pontoon buoyancy and simple damping do not provide real hull added mass, radiation memory, diffraction, or coupled six-axis wave response.

The next step adds those missing forces in the C++ core. A regular-wave case comes first, followed by full six-axis small-motion seakeeping and then irregular waves. If Chaos cannot represent the required hydrodynamic mass matrix, the core advances the boat state and Unreal renders the committed pose. This still runs as one Unreal simulation with one clock and one set of logs.

Capytaine, WEC-Sim, and published hull data provide offline comparisons. The runtime marine model stays in this project.

The water checkpoint starts with alignment: rendered waves and physics queries need to describe the same surface. ArduPilot then needs to hold heading and follow waypoints in calm water. Changing a wave needs to update the visible water, boat forces, and logs together. The engineering model needs to match the expected regular-wave amplitude and phase, and the whole case needs to reset and replay without clock or wave drift.

!!! tip "Read the working plan"

    See the repo's [main plan](https://github.com/EthanMBoos/UnrealArdupilot/blob/main/README.md), [fixed-wing plan](https://github.com/EthanMBoos/UnrealArdupilot/blob/main/docs/AERO.md), and [boat plan](https://github.com/EthanMBoos/UnrealArdupilot/blob/main/docs/WATER.md).
