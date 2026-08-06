# Bridges

Bridges are direct integrations between Cipher Core and external applications, services, devices, or operating-system facilities.

## Design goals

- Reproduce the target system's native action.
- Avoid fragile UI automation when a direct interface is feasible.
- Use a narrow, versioned command surface.
- Validate inputs at both ends.
- Return explicit success and error responses.
- Preserve application-owned configuration.
- Support lab isolation and rollback.
- Emit diagnostic telemetry.

## Preferred integration order

1. Supported native API or SDK
2. Versioned local IPC Bridge
3. Application plugin extension
4. Controlled command-line interface
5. UI automation as a documented last resort

## Bridge contract

Every Bridge must document:

- name, version, and owner;
- transport and endpoint;
- command schema;
- trust boundary;
- timeout, concurrency, and idempotency behavior;
- success and error responses;
- compatibility requirements;
- observability;
- deployment and rollback;
- validation evidence.

## Lifecycle

Bridges follow the lab and approval workflow in [SAFETY.md](../SAFETY.md). A validated lab Bridge is not production-deployed until separately approved.

## Registered Bridges

- [OpenRGB Effects Bridge v1.0](OpenRGB.md) — lab validated; production not deployed

## Discovery records

- [AIDA64 Bridge discovery](AIDA64-Discovery.md) — no safe native layout activation interface found; prototype blocked
