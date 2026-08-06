# Platform Architecture

Cipher Core is a modular personal operating system that coordinates intelligence, context, policy, capabilities, integrations, and presence.

## System model

```text
User
  |
Companion and Interfaces
  |
Cipher Core
  |-- Identity Layer
  |-- Core Intelligence
  |-- Context and Memory
  |-- Policy and Safety
  |-- Skills
  |-- Bridges
  |-- Telemetry and Chronicle
  |
Providers, Applications, Services, Devices
```

## Subsystem responsibilities

| Subsystem | Responsibility | Must not own |
|---|---|---|
| Cipher Core | Platform coordination and lifecycle | Provider-specific identity |
| Core | Reasoning orchestration and execution cycle | Presentation styling |
| Identity Layer | Appearance, voice, and presentation | Memory or personality mutation |
| Memory | Structured durable context | Unverified current state |
| Sensor Engine | Live system telemetry acquisition and normalization | Presentation or hardware control |
| Safety | Scope, approvals, isolation, and recovery | Product behavior |
| Skills | Modular approved abilities | Independent authority |
| Bridges | Direct external integrations | Business reasoning |
| Companion | Cipher's default visual presence | Separate intelligence |
| Providers | Replaceable reasoning and generation | Platform governance |
| Chronicle | Permanent engineering history | Live runtime state |

## Architectural boundaries

- Each subsystem has one clear responsibility.
- Cross-subsystem communication uses explicit contracts.
- Providers sit behind adapters.
- External systems sit behind Bridges whenever direct integration is feasible.
- Skills orchestrate capabilities but do not bypass Safety.
- Memory supplies context but never outranks verified current state.
- Companion renders Cipher's presence but does not fork Cipher's identity.

## State ownership

The component that creates authoritative state owns its schema and lifecycle. Cipher Core should reference external application state through a Bridge rather than duplicating or mutating application-owned configuration without need.

## Change model

Material architectural changes require:

1. a documented problem;
2. an isolated design or lab;
3. validation evidence;
4. an accepted decision record;
5. explicit production approval;
6. a rollback path.

See [SAFETY.md](SAFETY.md) and [DECISIONS/README.md](DECISIONS/README.md).
