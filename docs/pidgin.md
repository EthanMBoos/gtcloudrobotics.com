---
icon: lucide/route
hide:
- toc
---

# Pidgin Protocol

**Pidgin** is an **envelope protocol** for heterogeneous robotic fleets — common fields like position, heading, and status, plus extension payloads for vehicle-specific data. Adding a new platform (Skydio, Husky, BlueBoat) means writing one extension, not forking the codebase.

The protocol stands on its own: any autonomy stack, GCS, or middleware can adopt it without buying into anything else we build. Other systems only need to wrap their protobuf to plug in; once that's done, they're part of the ecosystem permanently.

```text
                      VEHICLE ↔ TOWER-SERVER                TOWER-SERVER ↔ UI
                       (protobuf/UDP multicast)              (JSON/WebSocket)
                       
┌─────────────┐                           ┌─────────────┐                    ┌─────────────┐
│   Vehicle   │                           │    Server   │                    │     UI      │
└──────┬──────┘                           └──────┬──────┘                    └──────┬──────┘
       │                                         │                                  │
       │                                         │◀────────── hello ────────────────│
       │                                         │─────────── welcome ─────────────▶│
       │                                         │            (fleet, manifests,    │
       │                                         │             availableExtensions) │
       │                                         │                                  │
       │────── VehicleTelemetry ────────────────▶│─────────── telemetry ───────────▶│
       │────── Heartbeat (capabilities) ────────▶│─────────── heartbeat ───────────▶│
       │                                         │                                  │
       │◀───── Command ──────────────────────────│◀────────── command ──────────────│
       │────── CommandAck ──────────────────────▶│─────────── command_ack ─────────▶│
```

!!! tip "Dive deeper"

    Read the full [pidgin protocol spec](https://github.com/EthanMBoos/tower-server/blob/main/docs/PROTOCOL.md) on GitHub.
