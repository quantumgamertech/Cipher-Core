# Startup Gateway

## Purpose

Startup Gateway is Cipher Core's session-entry boundary. It turns application startup into an explicit operating-policy decision while preserving Safe Mode as the default.

Status: **LAB IMPLEMENTATION**

## Flow

```text
Launch Cipher Core
        |
        v
Boot presentation
        |
        +-- Startup Gateway status
        +-- Presence Engine readiness
        +-- Cipher Pulse snapshot
        +-- Theme Engine policy
        +-- Hardware policy
        +-- RGB bridge policy
        |
        v
Safe / Lab / Live selection
        |
        v
Backend policy validation
        |
        v
Dashboard
```

The initialization list reflects actual local API results where interfaces exist. Hardware control and RGB validation are reported as deferred until Lab Mode rather than simulated during Safe startup.

Safe Mode enables telemetry and interface behavior only. Live Mode is the normal daily local experience: Companion, Cipher Vision, configured voice features, and Theme Center remain available while external RGB and hardware actions stay locked. Lab Mode invokes the existing owner-gated, fail-closed bridge workflow.

Lab Mode is an Owner/Admin surface. It remains hidden until the local backend validates `CIPHER_OWNER_PIN` and issues an HttpOnly browser-session cookie. The PIN is never embedded in frontend code or stored in localStorage. The backend independently rejects direct Lab requests without a valid in-memory session.

## RGB Readiness Contract

Lab Mode is not authorized by process presence or an open TCP port alone. Readiness requires:

1. The exact validated Lab executable is launched and its PID is recorded.
2. Port 6743 is owned by that PID.
3. The approved bridge DLL hash matches.
4. The named pipe accepts a complete health-check command.
5. The bridge returns the expected invalid-theme rejection, proving request and response flow.

The health check never loads a real profile. If any readiness check later fails, Startup Gateway revokes RGB authorization and Theme Center reports the shared offline state.

Runtime health is exposed locally through:

- `/api/startup/status`
- `/api/rgb/status`
- `/api/theme-center/status`

## Future Hooks

The presentation publishes these provider-neutral events:

- `ON_BOOT_BEGIN`
- `ON_BOOT_COMPLETE`
- `ON_MODE_SELECTED`
- `ON_SYSTEM_READY`

They currently have no voice, sound, theme, or hardware consumers. Future integrations must subscribe through the event interface rather than adding behavior directly to the Startup Gateway component.

## Animation Philosophy

- Fade from black without blocking subsystem initialization.
- Keep Companion central and use the existing identity artwork.
- Use restrained breathing and a single closed-to-open eye transition.
- Prefer CSS transforms and opacity to layout animation.
- Keep motion short, quiet, and non-repeating except for breathing.
- Honor reduced-motion preferences.
- Fade the fixed gateway layer away so dashboard layout never shifts.

## Safety

- The launcher always starts with action flags disabled.
- Missing Owner PIN configuration keeps Lab Mode unavailable.
- Owner sessions exist only in server memory and a session cookie.
- UI presentation cannot bypass backend mode validation.
- Lab Mode never kills production OpenRGB.
- Production conflicts fail closed.
- Live Mode cannot launch Lab OpenRGB or activate RGB hardware behavior.
- AIDA64 is outside this subsystem.

This is local access control, not production authentication. It does not provide user accounts, remote identity verification, brute-force throttling, encrypted transport, or durable audit history. It is suitable only for the loopback-bound Lab environment.

## Related Documents

- [Safety](../SAFETY.md)
- [Architecture](../ARCHITECTURE.md)
- [Companion Presence](Presence.md)
- [OpenRGB Bridge](../BRIDGES/OpenRGB.md)
