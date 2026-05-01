---
icon: lucide/route
hide:
- toc
---

# Pidgin Protocol

**Pidgin** is the wire contract between vehicles, `tower-server`, and operator clients. It keeps a small stable core for fields every fleet needs, then layers versioned extensions on top so a ground robot, quadrotor, fixed-wing aircraft, and marine vessel can share one operator surface without pretending they are the same machine.

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

## What Lives in the Core Envelope

Pidgin's base schema is intentionally small. The core message types carry the parts that are universal across domains:

- `VehicleTelemetry` for location, heading, speed, status, environment, and sequence data.
- `Heartbeat` for liveness plus advertised capabilities like supported commands, sensors, and extensions.
- `Command` for operator actions sent toward a vehicle.
- `CommandAck` for the command lifecycle: accepted, rejected, timeout, completed, or failed.
- `hello` and `welcome` for client bootstrap, including the current fleet snapshot and extension metadata.

That split matters operationally. Telemetry tells the UI what the vehicle is doing now. Heartbeats tell the UI what the vehicle is capable of doing at all. Commands are validated against those capabilities before they are forwarded.

## Why Extensions Work

Pidgin does not try to flatten every robot into one giant schema. Instead, it uses a stable envelope with versioned extension payloads:

1. The core proto carries the fields that should mean the same thing for every vehicle.
2. Vehicle-specific data rides in an `extensions` map keyed by namespace, such as `husky` or `camera`.
3. Each extension payload is versioned independently, so one project can evolve without forcing a protocol fork.
4. The server decodes those payloads into JSON for the UI, which keeps the browser free of protobuf runtime and extension-specific binary handling.

In practice, that means a vehicle like the ModalAI Starling 2 can publish flight-specific state through its extension payload while still fitting the same fleet model as a ground or marine robot.

```json
{
       "type": "telemetry",
       "vehicleId": "starling-02",
       "data": {
              "environment": "air",
              "supportedExtensions": ["starling"],
              "extensions": {
                     "starling": {
                            "_version": 1,
                            "flightMode": "OFFBOARD",
                            "missionState": "TRANSIT",
                            "batteryPercent": 68,
                            "linkQuality": 0.91,
                            "windEstimateMs": 4.2
                     }
              }
       }
}
```

## Capabilities Are First-Class

One of the most important protocol choices is that vehicles explicitly advertise what they support instead of forcing the UI to guess.

- A stationary sensor node should not show `goto`.
- A fixed-wing aircraft may reject `stop` because that concept is unsafe or meaningless.
- A Husky may support only a subset of extension actions such as `setDriveMode` and `triggerEStop`.

Pidgin handles that with capability data in heartbeat messages. The server uses those capabilities to validate commands, and the UI uses the same data to decide which controls to render. The result is a tighter operator experience: fewer dead buttons, fewer silent failures, and clearer reasons when a command is rejected.

## Server as the Translation Boundary

Vehicles speak protobuf on multicast. Operator clients receive JSON over WebSocket. `tower-server` is the translation boundary between those two worlds.

- It registers the extension codecs compiled into the server.
- It publishes `availableExtensions` and manifests in the `welcome` message.
- It decodes extension telemetry into readable JSON.
- It rejects unknown namespaces or unsupported actions without breaking the rest of the telemetry stream.

That makes the server the source of truth for what extensions exist, while each vehicle remains the source of truth for which of those extensions it actually implements.

## Integration Contract

Pidgin is designed so the protocol scales without turning the server into a zoo of one-off bridges. Teams integrate by translating their robot state into `VehicleTelemetry` and `Heartbeat`, then emitting Pidgin on the multicast groups. If they want command support, they subscribe to the command channel and relay those actions back into their stack.

The consequence is deliberate: the server stays pure Pidgin, ownership stays clear, and adding a new platform is mostly translation work at the edge instead of central bridge maintenance in the middle.

!!! tip "Dive deeper"

       Read the full [pidgin protocol spec](https://github.com/EthanMBoos/tower-server/blob/main/docs/PROTOCOL.md) and the [extension architecture notes](https://github.com/EthanMBoos/tower-server/blob/main/docs/EXTENSIBILITY.md) on GitHub.
