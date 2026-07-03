---
icon: lucide/route
hide:
- toc
---

# Pidgin Protocol

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

[:fontawesome-brands-github: View pidgin.proto on GitHub](https://github.com/EthanMBoos/tower-server/blob/main/api/proto/pidgin.proto){ .md-button }

**Pidgin** is the wire contract between vehicles, [tower-server](https://github.com/EthanMBoos/tower-server), and operator clients. It keeps a small stable core for fields every fleet needs, then layers versioned extensions on top so a ground robot, quadrotor, fixed-wing aircraft, and marine vessel can share one operator surface without pretending they are the same machine.

Vehicles speak protobuf on multicast. Operator clients receive JSON over WebSocket. **[tower-server](https://github.com/EthanMBoos/tower-server)** is the translation boundary between those two worlds: it registers the extension codecs compiled into the server, publishes `availableExtensions` and manifests in the `welcome` message, decodes extension telemetry into readable JSON, and rejects unknown namespaces or unsupported actions without breaking the rest of the telemetry stream.

That makes the server the source of truth for what extensions exist, while each vehicle remains the source of truth for which of those extensions it actually implements.

## What Lives in the Core Envelope

Pidgin's base schema is intentionally small. The core message types carry the parts that are universal across domains:

- `VehicleTelemetry` for location, heading, speed, status, environment, and sequence data.
- `Heartbeat` for liveness plus advertised capabilities like supported commands, sensors, and extensions.
- `Command` for operator actions sent toward a vehicle.
- `CommandAck` for the command lifecycle: accepted, rejected, timeout, completed, or failed.
- `hello` and `welcome` for client bootstrap, including the current fleet snapshot and extension metadata.

That split matters operationally. Telemetry tells the UI what the vehicle is doing now. Heartbeats tell the UI what the vehicle is capable of doing at all. Commands are validated against those capabilities before they are forwarded.

## Why Extensions Work

Pidgin does not try to flatten every robot into one giant schema. Instead, it uses a stable envelope with versioned extension payloads: the core proto carries the fields that should mean the same thing for every vehicle, vehicle-specific data rides in an `extensions` map keyed by namespace such as `husky` or `skydio`, and each extension payload is versioned independently so one project can evolve without forcing a protocol fork. Extension authors get full protobuf freedom inside that payload: nested messages, enums, repeated fields, whatever the vehicle actually needs.

That freedom lives at the schema level, not at the boundary where telemetry reaches the UI. **tower-server** decodes each extension's proto into a JSON map for the browser, keeping the protobuf runtime and per-extension binary handling entirely server-side, and every value in that map is required to be a primitive leaf: bool, string, or number. The reason is structural, not incidental. The operator UI derives its field list for any extension generically, by walking whatever keys show up in `vehicle.extensions`, so a new vehicle type renders in the fleet panel with zero per-vehicle UI code, but that same generic renderer only knows how to display primitives and silently drops anything nested. The codec absorbs that constraint: `DecodeTelemetry` flattens sub-messages into prefixed keys (`bumperFrontLeft`, `gimbalPitchDeg`) so extension authors keep full protobuf freedom in how they model the vehicle, nested messages included, without the UI ever seeing that nesting.

In practice, that means a Clearpath Husky UGV can publish drive-specific state through its extension payload while still fitting the same fleet model as an aerial or marine robot. The example below mirrors the live [`husky` extension](https://github.com/EthanMBoos/tower-server/tree/main/internal/extensions/husky) shipped in tower-server.

```json
{
       "type": "telemetry",
       "vehicleId": "husky-01",
       "data": {
              "environment": "ground",
              "supportedExtensions": ["husky"],
              "extensions": {
                     "husky": {
                            "_version": 1,
                            "driveMode": "autonomous",
                            "batteryVoltage": 25.6,
                            "motorTempLeftC": 45.2,
                            "motorTempRightC": 47.8,
                            "odometryLeftM": 142.3,
                            "odometryRightM": 141.9,
                            "estopEngaged": false,
                            "bumperFrontLeft": false,
                            "bumperFrontRight": false,
                            "bumperRearLeft": false,
                            "bumperRearRight": false
                     }
              }
       }
}
```

The [codec](https://github.com/EthanMBoos/tower-server/blob/main/internal/extensions/husky/codec.go) applies exactly that contract: `HuskyTelemetry` models bumper state as a single `BumperContacts` sub-message, but `DecodeTelemetry` flattens it into the four `bumperFrontLeft`/`bumperFrontRight`/`bumperRearLeft`/`bumperRearRight` keys above instead of emitting a nested object.

Commands flow the opposite direction through the same namespace. An operator switching drive modes sends:

```json
{
       "action": "extension",
       "namespace": "husky",
       "payload": {
              "type": "setDriveMode",
              "mode": "autonomous"
       }
}
```

**tower-server** routes `payload.type` to the codec's `EncodeCommand`, which turns the JSON payload into the matching `SetDriveModeCommand` proto message before it reaches the vehicle.

## Capabilities Are First-Class

One of the most important protocol choices is that vehicles explicitly advertise what they support instead of forcing the UI to guess. A stationary sensor node should not show `goto`, a fixed-wing aircraft may reject `stop` because that concept is unsafe or meaningless, and a Husky may support only a subset of extension actions such as `setDriveMode` and `triggerEStop`.

Pidgin handles that with capability data in heartbeat messages. The server uses those capabilities to validate commands, and the UI uses the same data to decide which controls to render. The result is a tighter operator experience: fewer dead buttons, fewer silent failures, and clearer reasons when a command is rejected.

## Integration Contract

Pidgin is designed so the protocol scales without turning the server into a zoo of one-off bridges. Teams integrate by translating their robot state into `VehicleTelemetry` and `Heartbeat`, then emitting Pidgin on the multicast groups. If they want command support, they subscribe to the command channel and relay those actions back into their stack.

The consequence is deliberate: the server stays pure Pidgin, ownership stays clear, and adding a new platform is mostly translation work at the edge instead of central bridge maintenance in the middle.

!!! tip "Dive deeper"

       Read the full [pidgin protocol spec](https://github.com/EthanMBoos/tower-server/blob/main/docs/PROTOCOL.md) and the [extension architecture notes](https://github.com/EthanMBoos/tower-server/blob/main/docs/EXTENSIBILITY.md) on GitHub.
