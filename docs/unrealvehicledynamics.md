---
icon: lucide/plane
hide:
- toc
---

# UnrealVehicleDynamics

[:fontawesome-brands-github: View on GitHub](https://github.com/EthanMBoos/UnrealVehicleDynamics){ .md-button }

**UnrealVehicleDynamics** is a controls-oriented vehicle dynamics toolkit being built for native use in Unreal Engine. It keeps the engineering equations in a shared C++ core so the same vehicle model can support fast analysis without Unreal and, later, a visual simulation with external flight or marine controllers.

The working result today is the headless fixed-wing path. It calculates aerodynamic and propulsion forces, advances the aircraft state, finds steady flight conditions, produces local linear models, runs scripted control inputs, and saves deterministic runs for comparison and replay.

Unreal, ArduPilot, PX4, and marine integration are the next stages of the project. They are not part of the current result. The research question is whether one readable, testable dynamics model can remain consistent across controls analysis, an interactive Unreal world, and production controller software.

## Model, analyze, replay

```text
vehicle + experiment configuration
               |
               v
       shared C++ force model
               |
               | force + moment
               v
        headless motion solver
               |
               v
   labelled signals + run bundle
               |
               +-> compare / replay / MATLAB / Python
```

The core answers one bounded question: given the vehicle state, controls, and environment, what forces and moments act on the vehicle? Configuration files hold the mass, inertia, coefficients, control mappings, initial state, wind, and command schedule. The equations remain ordinary C++ with explicit vectors, matrices, units, and coordinate frames so a controls engineer can relate the implementation to a textbook model.

The command-line tools use that model to simulate a maneuver, find a trim point, linearize about it, apply control doublets, inspect forces, and replay a saved run. A trim point is a steady operating condition such as level flight. Linearization produces the local state-space matrices used for stability analysis and controller design. These tasks run without starting a game engine.

Each run records its resolved configuration, timing, commands, states, forces, moments, and derived air data together. A repeated run can therefore be compared against the original rather than judged from an animation. MATLAB and Python can load the same labelled signals for analysis.

## The current aircraft model

The first aircraft uses the educational Aerosonde parameters from [BYU MAVSim](https://github.com/byu-magicc/mavsim_public/blob/a8489bbc30ab9e746dccac8ac614ab2f8acac6bb/mavsim_python/parameters/aerosonde_parameters.py). The model calculates air-relative velocity, angle of attack, sideslip, dynamic pressure, aerodynamic forces and moments, control-surface effects, propeller thrust and torque, ISA atmosphere, and constant wind.

The repository tests individual force cases, rigid-body motion, trim, linearization, deterministic replay, and the data written by the tools. A pinned JSBSim aircraft built from the same source parameters provides an independent implementation comparison for selected frozen-state cases. That comparison can expose sign, frame, unit, and equation errors; it is not a substitute for validation against flight data.

The current model is deliberately narrow. It covers conventional fixed-wing flight around the documented operating region. Ground handling, takeoff, landing gear, stall and post-stall behavior, turbulence, sensor models, actuator dynamics, and closed-loop autopilot operation remain future work.

## One model, two runtimes

Unreal is the intended main runtime, not a disposable viewer. The next integration will compile the shared C++ sources directly into an Unreal plugin. Unreal will own the world, fixed simulation clock, actors, rendering, collisions, and controller connection. The core will continue to own the engineering force and moment equations.

```text
                         +-> headless solver -> analysis and replay
shared vehicle model ----|
                         +-> Unreal / Chaos -> visual simulation and collisions
```

For the first aircraft integration, the Unreal adapter will give the core a vehicle state and controls on each physics step. The core will return one force and moment, and Chaos will advance the rigid body. The headless path uses a standard numerical motion solver instead. Matching force cases and timestep studies will check that both paths represent the same equations. Render rate, scenery, and a visual hitch must not silently change the physics result.

External controllers will close the loop through simulated sensors and actuator commands. ArduPlane is the first target, with PX4 planned through the same vehicle boundary. Commands, physical actuator positions, forces, state, and sensor outputs need to share one timestamp so a bad mapping or delay can be found in the data rather than guessed from the picture.

## Water has to agree with the picture

Water makes the visual and physical contract harder. The first boat demo will use Unreal Water, buoyancy, and Chaos to establish the complete loop. One wave definition must drive both the rendered surface and every water-height query used by the physics. A crest on screen where the force model sees a trough is a failed simulation, however convincing either result looks by itself.

Stock buoyancy is only a starting point. Engineering seakeeping eventually requires effects such as coupled six-axis motion, added mass, radiation memory, and wave excitation. If Chaos cannot express the required model, the C++ core will advance the boat state while Unreal renders the committed pose. The wave components, phase, and simulation time will still be shared so the water, vehicle motion, calculated forces, logs, pause, reset, and replay remain aligned.

!!! tip "Read the working plan"

    See the repo's [main plan](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/PLANNING.md), [Unreal integration plan](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/UNREAL.md), [fixed-wing plan](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/AERO.md), and [water plan](https://github.com/EthanMBoos/UnrealVehicleDynamics/blob/main/docs/WATER.md).
