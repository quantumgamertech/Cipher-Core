# Cipher Core Architecture

Cipher Core separates visual state from providers and side effects. The v0.9 build is a local UI foundation; it is not an automation agent.

## Dashboard layer

React components render the face, controls, onboarding, identities, telemetry, modes, integrations, console, and version state. Components receive normalized data and do not connect directly to accounts or hardware. An error boundary provides a safe fallback if rendering fails.

## Identity and onboarding layer

`identities.js` is the visual/personality catalog. `identityService.js` owns public selection rules, Founder’s Edition enforcement, name normalization, and prototype profile creation. The First Experience consumes that service and keeps its profile in React memory only. The command center and Identity System reuse the same `LivingCipherFace` component.

## Service layer

- `voice`: creates text-only simulated speech sequences
- `telemetry`: selects the configured read provider; currently mock-only
- `hardware`: returns normalized mock device state and rejects action requests
- `integrations`: returns disconnected mock records
- `commands`: parses a strict whitelist into safe UI-only effects
- `identity`: resolves identity policy and creates local prototype profiles

## Brain layer

The future brain belongs outside the dashboard. It will need intent normalization, policy evaluation, explicit permissions, confirmations, audit logs, cancellation, and recovery. v0.9 contains no AI runtime or real action router.

## Hardware layer

Future device adapters should implement small, testable interfaces and keep read capabilities separate from writes. Hardware control remains disabled. The existing bus is only a state contract.

## Integrations layer

External services must remain isolated behind adapters with narrowly scoped credentials, visible connection state, timeouts, redaction, and independent disable controls. No adapters are connected in v0.9.

## Intended future data flow

```text
Dashboard
   ↕ local typed events
Permission Gate / Brain
   ↕ validated internal actions
Isolated Provider Adapters
   ↕ explicit opt-in only
Local devices or approved services
```

## Configuration and secrets

`config/cipher.config.example.json` documents safe defaults. It is not a secret store. Future secrets should use OS-protected storage or environment injection and must never be committed.

## Why pre-1.0 remains isolated

Accounts, microphone access, remote control, AI execution, and hardware writes create material security and consent risks. v0.9 proves the interface and contracts while all such capabilities remain mocked, disconnected, or rejected.
