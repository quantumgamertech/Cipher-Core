# Telemetry Plan

The dashboard reads from `telemetryService`, which selects the configured provider. v0.9 locks that setting to:

```json
{ "telemetryProvider": "mock" }
```

The mock provider updates CPU, GPU, RAM, disk, network, uptime, and a zeroed FPS placeholder every few seconds.

Future LibreHardwareMonitor or HWiNFO support should run through a separate, read-only local bridge. Requirements include:

- Explicit opt-in and documented installation
- No automatic elevation
- Data timeouts and stale-sample indicators
- Unit normalization and sensor-name mapping
- Graceful operation when the monitor is missing
- No fan, voltage, overclock, or other hardware-writing controls
