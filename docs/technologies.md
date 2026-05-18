---
icon: lucide/cpu
hide:
- toc
---

# What technologies are used?
This page is intentionally a design-decisions summary, not a dependency dump. Each repo uses a different stack because each one is solving a different operational problem: desktop mission planning, field operation, protocol bridging, and onboard autonomy all have different constraints.

| Repo | Primary technologies | Why this stack fits |
| --- | --- | --- |
| `Tower` | Electron, React, TypeScript, Zustand, MapLibre, deck.gl | Desktop mission planner with a hybrid MapLibre/deck.gl renderer built for dense 3D editing on GPU-equipped hardware |
| `Tower-Field` | React, TypeScript, Vite, PWA, Leaflet, Leaflet.draw | Browser-first field interface with swappable basemaps, transparent overlay deployment, and touch-first operation on low-compute devices |
| `tower-server` | Go, protobuf, UDP multicast, WebSocket, JSON | Protocol bridge between multicast protobuf (vehicles) and WebSocket JSON (UI), shipped as a single binary |
| `MAF` | C++20, ArduPilot, BehaviorTree.CPP, MAVLink, Zenoh, ONNX, MCAP, Docker | Contract-driven onboard runtime keeping ArduPilot as vehicle authority, plain C++ as the application model, and ONNX as the artifact contract for learned components |

## Tower

The map stack is the real differentiator. **MapLibre GL JS** owns the base map, style swaps, DEM terrain, and features that must drape cleanly on terrain. **deck.gl** is injected directly into MapLibre's render loop through `MapboxOverlay` in interleaved mode, so both systems share one WebGL context instead of fighting through separate canvases.

That creates a deliberate split renderer: `EditableGeoJsonLayer`, `SolidPolygonLayer`, `PathLayer`, and `ScenegraphLayer` handle interactive editing, 3D zone walls and ceilings, air routes, and airborne vehicle models, while native MapLibre symbol and line layers are reserved for ground vehicles, ground routes, search points, and pins because MapLibre can GPU-drape those reliably onto terrain and deck.gl cannot. Features that need explicit elevation are sampled asynchronously with `queryTerrainElevation()` and batched with `requestIdleCallback`, then rendered with different depth settings depending on whether they need to sit on top of terrain or participate in full 3D occlusion.

**Electron**, **React 19 + TypeScript**, **Zustand**, and **Vite** carry the rest — cross-platform desktop shell, complex UI composition, low-boilerplate shared state, and a fast build loop. The architecture is intentionally compute-heavy, but it buys the desktop app the dense, high-fidelity mission editing it's optimized for.

## Tower-Field

[Tower-Field](https://github.com/EthanMBoos/Tower-Field) has almost the opposite constraints from Tower — outdoor operation, high-daylight visibility, touch use, low-end hardware, minimal cognitive load — so it stays in the browser as a **Progressive Web App** built with **React + TypeScript + Vite**.

The biggest decision is using **Leaflet** with **react-leaflet** and **Leaflet.draw** rather than MapLibre or deck.gl. The deeper architectural point is that the field app treats the basemap as a replaceable backend instead of the center of the system: the map is just a `MapContainer` plus a `TileLayer`, with mission geometry, polylines, markers, and draw state layered above through React and Leaflet primitives. Because the basemap is only a tile source, it can be swapped to different imagery providers, run standalone, or disappear entirely when the app is embedded as a transparent **WebView overlay** on top of TAK, WinTAK, ATAK, or another C2 system.

Browser-first packaging matters for the same reason. A PWA avoids native bridge overhead, app-store deployment, and GPU assumptions, while keeping WebSocket transport native to the browser and making the same app usable as a standalone field tool, a tablet shortcut, a side-by-side browser tab, or an embedded overlay.

## tower-server

**Go** fits because tower-server is a fan-in / fan-out boundary: many multicast telemetry sources in, many WebSocket UI clients out, with translation and validation in between. Single binary, fast startup, simple cross-compilation, and straightforward concurrency for that I/O shape — exactly what the job wants.

The technology mix follows directly: **protobuf** on the vehicle side (compact, schema-evolved, multicast-friendly), **JSON over WebSocket** on the browser side (no protobuf runtime in the browser, no extension-specific binary handling), with Go handling the translation in between and the per-vehicle bookkeeping (sequence-number deduplication, capability tracking, command admission) the [pidgin protocol](pidgin.md) requires.

## MAF

The onboard autonomy runtime is closer to mission authority and control-adjacent timing than to UI or protocol bridging, so the stack reflects those constraints directly. See [MAF](maf.md) for the architectural argument; this section is the technology rationale.

- **C++20.** Direct classes, explicit loops, bounded queues, transport-agnostic contracts. Plain C++ keeps the live middleware graph from becoming the application model.
- **ArduPilot + MAVLink.** ArduPilot is the certified vehicle authority; MAVLink is the practical boundary, over UDP in SITL and serial on hardware.
- **BehaviorTree.CPP.** The mission executive, not just a helper library — every BT node satisfies the same goal-context-in / command-stream-out contract whether it's hand-coded or wraps an ONNX model.
- **ONNX.** The artifact contract for learned components. Training and deployment runtimes are deliberately decoupled — policies train in GPU environments, export to ONNX, and deploy through a hardened admission step.
- **Zenoh.** The default transport between modules where the in-process boundary doesn't reach. Transport is an adapter; the contract boundary stays stable across substitutions.
- **MCAP.** The recording format, written by the standalone `maf_recorder` process so a runtime crash never takes the black box down with it.
- **Docker Compose + multi-arch builds.** Same image path from SITL on a laptop to on-vehicle deployment.
- **ROS 2 (optional).** An edge adapter for sensors, cameras, visualization, or ecosystem integration — not the required substrate for core autonomy.

## Why the stacks differ

Across the repos, the pattern is consistent: the technology follows the operator, hardware, and deployment environment.

- The desktop planner uses the richest stack that best supports dense 3D mission planning.
- The field app uses the lightest stack that still supports operational overlays and touch interaction.
- tower-server uses the easiest stack to ship as a reliable cross-platform bridge.
- The autonomy runtime uses the most direct stack for control, timing, and hardware integration.

The question is not which technology stack is best in the abstract. It is which stack best fits the real constraints of each repo.
