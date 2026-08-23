---
icon: lucide/plane
hide:
- toc
---

# Unreal Vehicle Dynamics

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/UnrealVehicleDynamics){ .md-button }

**Unreal Vehicle Dynamics** runs C++ vehicle models headlessly or inside Unreal
Engine with Cesium and ArduPilot SITL. The repository now includes two working
examples:

- a BYU/MAVSim Aerosonde controlled by ArduPlane; and
- a Fossen Otter surface vessel controlled by ArduRover.

The project is kept small on purpose. A controls engineer can change plant or
controller parameters, run a representative maneuver, and inspect the result.
It is a working simulation reference, not a claim that either bundled model
matches a physical vehicle.

```text
ArduPilot PWM
      |
      v
shared C++ model -> committed vehicle state -> ArduPilot sensors
      |                       |
      +-> headless CSV        +-> Unreal and Cesium
```

## The two demonstrations

The aircraft run starts an Aerosonde in flight and connects it to ArduPlane in
Fly By Wire A. The controller receives simulated state, stabilizes roll and
pitch, and drives a short right-left roll sequence.

The boat run connects the Otter model to ArduRover in ACRO. It applies a speed
step, a turn-rate step, recovery, and a clean stop. The report shows target and
measured speed and yaw rate, left and right motor PWM, saturation, plant truth,
trajectory, and controller timing.

```sh
./run.py                    # Aerosonde + ArduPlane
./run.py otter              # Otter + ArduRover
./run.py otter-open-loop    # Otter without ArduRover
```

Each command builds the C++ core and Unreal plugin, opens the game window,
starts the selected ArduPilot container, and stops the run when the experiment
ends. Cesium supplies the georeferenced world. The camera provides chase,
orbit, onboard, and side views, including free orbit while the model is paused.

Each run saves a self-contained Plotly report with the simulator truth,
ArduPilot telemetry, controller exchange timing, and DataFlash files. The
exchange checks verify that one accepted controller frame advances one fixed
simulation step. An estimator may differ from plant truth without indicating a
broken state transfer, so those signals remain separate in the report.

## One core, two state owners

The engineering equations live in an ordinary C++ library with no Unreal,
networking, JSON, or process code. The CLI and Unreal plugin compile the same
model sources.

The Aerosonde model returns body force and moment. Unreal Chaos advances the
aircraft rigid body. The Otter has a coupled six-axis effective mass matrix, so
its C++ RK4 solver advances the vessel and shaft states while Unreal renders
the committed pose. This prevents a second rigid-body solver from changing the
marine equations.

Both paths use SI units, North-East-Down world axes, and Forward-Right-Down body
axes. Unreal owns the fixed simulation clock and exchanges state and PWM with
ArduPilot once per accepted controller frame.

## Headless model work

You can inspect either plant without starting Unreal or ArduPilot:

```sh
cmake -S . -B build
cmake --build build

build/uvd evaluate examples/run.json
build/uvd simulate examples/run.json --duration 10 --output runs/aerosonde.csv

build/uvd evaluate examples/otter-run.json
build/uvd simulate examples/otter-run.json --duration 10 --output runs/otter.csv
```

`evaluate` exposes the state, forces, moments, and useful intermediate terms at
one operating point. `simulate` advances the same equations with a constant
command and writes a labelled trajectory. The fixed-wing model also provides
trim and local linearization for operating-point analysis.

## Reference models and limits

The aircraft parameters come from the educational Aerosonde in
[BYU MAVSim](https://github.com/byu-magicc/mavsim_public/blob/a8489bbc30ab9e746dccac8ac614ab2f8acac6bb/mavsim_python/parameters/aerosonde_parameters.py).
An optional JSBSim comparison evaluates the same aerodynamic equations over
fixed and random states. It catches sign, frame, unit, and porting errors; it
does not replace flight-test data.

The boat is a C++ port of Thor Fossen's
[`otter.m`](https://github.com/cybergalactic/MSS/blob/d7c1e969856f4e98bc2f6ffa466d0abd6ec5d950/CRAFT/USV/models/otter.m)
from the Marine Systems Simulator. Its tests compare committed MSS reference
outputs for equilibrium, propulsion, asymmetric motion, water current,
cross-flow, and hydrostatic loading. Keeping those outputs in the test suite
avoids requiring MATLAB, Octave, and an MSS checkout for a normal build.

These are educational models with clear boundaries. The aircraft is air-started
and has no ground contact, takeoff, landing, or measured stall model. The Otter
runs in calm water with horizontal current and has no waves, contacts, planing,
or measured trajectory validation. The current visuals are replaceable and do
not define the dynamics.

!!! note "Read the engineering docs"

    Start with the repository [README](https://github.com/EthanMBoos/UnrealVehicleDynamics#readme),
    then see the [ArduPlane workflow](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/ARDUPILOT.md),
    [ArduRover and Otter workflow](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/ARDUROVER.md),
    [Unreal runtime](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/UNREAL.md),
    and [installation instructions](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/INSTALL.md).
