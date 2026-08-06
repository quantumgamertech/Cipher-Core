# Decision: Cipher Vision v1 Sensor Engine

- **Date:** 2026-07-05
- **Status:** Accepted architecture; local implementation validated; not deployed
- **Area:** Telemetry / Sensor Engine / Dashboard

## Context

The Cipher Core dashboard displayed simulated telemetry generated inside the React client. That design could not provide verified system state and could not be reused by future Cipher Core subsystems.

## Decision

Introduce Cipher Vision as a dedicated backend Sensor Engine:

```text
Dashboard
    ↓
/api/telemetry
    ↓
Cipher Vision Sensor Engine
    ↓
Windows performance data and optional hardware providers
```

The UI never reads Windows directly.

## Sources

- CPU utilization: Windows formatted performance data
- GPU utilization: Windows GPU Engine performance data
- GPU temperature: installed NVIDIA driver through `nvidia-smi`
- RAM usage: Node operating-system API
- Disk usage: Node `statfs`
- Network throughput and utilization: Windows formatted performance data
- Session uptime: Sensor Engine lifecycle
- CPU temperature: unavailable unless a reliable optional hardware provider exposes it

Libre Hardware Monitor WMI is supported as an optional read-only temperature source but is not installed or required.

## Behavior

- A single long-lived native worker samples approximately once per second.
- The Sensor Engine caches the latest worker sample.
- The API adds native RAM, disk, and session uptime values.
- Stale or unavailable sensors return `null` or degraded status rather than invented values.
- The frontend polls only `/api/telemetry`.

## Consequences

### Positive

- Removes simulated telemetry.
- Adds no package dependency.
- Establishes a reusable service boundary for Companion, Monitor Display, Hardware Bus, Voice, and Skills.
- Preserves the existing System panel styling and structure.
- Keeps unavailable CPU temperature honest.

### Constraints

- Windows performance counter names and availability depend on the host.
- NVIDIA temperature requires the installed NVIDIA driver tool.
- CPU temperature requires an optional reliable hardware provider.
- The current API is local to the Vite-hosted dashboard runtime.

## Validation

- Native worker emitted changing live samples.
- `/api/telemetry` returned live CPU, GPU, RAM, disk, network, GPU temperature, and uptime data.
- Automated tests passed: 42/42.
- Vite build passed.
- Theme Center and RGB Bridge tests remained green.
- No deployment or production hardware mutation occurred.

## Rollback

Remove the Sensor Engine plugin and restore the previous telemetry client. Do not silently restore simulated data in a production surface; label any future fallback explicitly.
