# Decision: OpenRGB Effects Bridge v1.0

- **Date:** 2026-07-04
- **Status:** Accepted architecture; lab validated; production not deployed
- **Area:** Bridges / Theme Center / OpenRGB Effects

## Context

Theme Center needed to reproduce the native OpenRGB Effects `LoadProfile` action without restarting OpenRGB, modifying Effects configuration, relying on SDK Packet 23, or using UI automation.

Packet 23 reached no usable handler in the installed integration and produced no visual effect. Restart/config workflows introduced timing problems, default-color flashes, and unnecessary production risk.

## Decision

Extend the OpenRGB Effects plugin with a versioned local named-pipe Bridge:

`\\.\pipe\CipherCore.OpenRGBEffects.v1`

Supported commands:

- `LOAD PurpleBlue`
- `LOAD Inferno`
- `LOAD Ice`
- `LOAD Matrix`
- `LOAD Stealth`

The Bridge validates the theme, queues `OpenRGBEffectTab::LoadProfile(themeName)` on the Qt UI thread, and returns an explicit success or error response.

Theme Center uses this Bridge only when `ENABLE_THEME_ACTIONS=true`. Otherwise it remains in dry-run mode.

## Duplicate-load finding

The lab runtime initially loaded both the original Effects plugin and the Bridge build. One user command therefore interacted with multiple Effects engines and caused visible flicker.

The fix:

- allow exactly one Effects plugin DLL to load;
- track the current and most recently loaded profile;
- debounce same-profile requests;
- preserve immediate legitimate switching between different profiles.

## Validation

- Bridge DLL SHA-256:  
  `0BEF7C41742D2334819F6520EE10D2640DE1975655F12E02B30A20FD3790BF49`
- No `Qt5Network.dll` dependency.
- Build completed with zero detected compiler or linker errors.
- Automated tests: 46/46 passed.
- PurpleBlue validated across all detected RGB hardware.
- Inferno validated across all detected RGB hardware.
- No flicker.
- One OpenRGB process.
- One Effects plugin DLL.
- Theme Center reported `OK QUEUED` and `Applied`.
- Files changed during apply: zero.
- AIDA64 skipped.
- Production OpenRGB remained untouched.

## Consequences

### Positive

- Matches the application's native in-process action.
- No OpenRGB restart or default-color flash.
- No profile or configuration mutation.
- Small, explicit command surface.
- Provider-independent local integration pattern.
- Suitable foundation for future Cipher Core Bridges.

### Constraints

- Requires the compatible Bridge-enabled Effects plugin.
- The named pipe is local to Windows.
- Production promotion requires a separate approved deployment and rollback plan.

## Rejected approaches

- SDK Packet 23: command sent but produced no visual change.
- Restart/config mutation: unreliable timing and visible interruption.
- UI automation: fragile and unnecessary after direct integration succeeded.

## Rollback

Stop using the Bridge-enabled plugin and restore the previously backed-up Effects plugin DLL. Theme Center must remain dry-run or disable live actions until compatibility is restored. Production configuration files and RGB profiles are not part of this Bridge deployment.

## Related documents

- [OpenRGB Bridge specification](../BRIDGES/OpenRGB.md)
- [Chronicle milestone](../MEMORY/CHRONICLE.md)
- [Bridge standards](../BRIDGES/README.md)
- [Safety and production governance](../SAFETY.md)
