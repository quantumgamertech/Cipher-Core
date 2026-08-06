# Theme Center RGB Bridge Complete

- **Date:** 2026-07-05
- **Subsystem status:** COMPLETE
- **Validation status:** LAB VALIDATED
- **Review status:** READY FOR PRODUCTION REVIEW
- **Production status:** NOT DEPLOYED

## Summary

Theme Center now controls OpenRGB exclusively through the Cipher Core Bridge.

The previous restart, configuration-rewrite, SDK Packet 23, polling, and application-mutation architecture has been retired from the active Theme Center implementation.

This is the first completed production-quality subsystem developed under the Cipher Core Operating Manual.

## Architecture

```text
Theme Center
    ↓
Named Pipe
    ↓
Cipher Core Bridge
    ↓
OpenRGB Effects Plugin
    ↓
LoadProfile()
```

Named pipe:

`\\.\pipe\CipherCore.OpenRGBEffects.v1`

## Accomplishments

- Named Pipe Bridge implemented
- Theme Center migrated
- Legacy restart path removed
- SDK Packet 23 removed
- `EffectSettings.json` rewrite removed
- SDK polling removed
- Restart and `taskkill` control removed
- AIDA64 mutation removed
- Single Bridge architecture adopted
- Five approved themes supported
- Dry-run support retained
- Backend apply lock retained
- UI debounce retained

Approved themes:

- PurpleBlue
- Inferno
- Ice
- Matrix
- Stealth

## Validation

Lab validation completed.

Verified:

- PurpleBlue
- Inferno
- Ice
- Matrix
- Stealth

Results:

- Immediate profile changes
- No flicker
- No OpenRGB restart
- No configuration writes
- No production mutation

Tests:

- Automated tests passed: 36/36
- Build passed
- Manual hardware validation passed

Manual hardware validation confirmed full-system response across detected motherboard lighting, four ENE RAM controllers, fans, Strimer cables, AIO tubes, and present Logitech hardware.

## Engineering Decision

This milestone formally establishes the Cipher Core Bridge pattern as the preferred integration model.

Future subsystems should expose clean, versioned interfaces instead of relying on:

- UI automation
- Process restarts
- Configuration rewrites
- Polling hacks

Bridges must remain bounded by the approval and promotion workflow defined in [SAFETY.md](../../SAFETY.md).

## Lessons Learned

### Original flicker root cause

The lab runtime loaded two OpenRGB Effects plugin DLLs: the original plugin and the Bridge-enabled build. Both Effects engines became active in the same OpenRGB process.

A single profile request therefore interacted with overlapping plugin instances and effect execution, producing visible instability and flicker.

### Duplicate plugin loading

Renaming the original DLL did not disable it because OpenRGB loaded every compatible DLL in the plugin directory. The original plugin had to be moved outside the loadable plugin directory so exactly one Effects plugin instance remained.

Instrumentation then confirmed the Bridge received one command and the profile load path executed through one plugin instance.

### Why the Bridge simplified the system

The Bridge invokes the Effects plugin's native `LoadProfile()` action through a narrow local interface. Theme Center no longer needs to understand OpenRGB startup timing, controller detection, configuration ownership, SDK plugin discovery, or process recovery.

The integration now has one responsibility:

`validated theme request → native Effects profile load`

### Why one clean execution path is preferred

Competing restart, SDK, configuration, and UI paths created different timing, failure, and state models. Maintaining them together increased ambiguity and regression risk.

One execution path provides:

- one command contract;
- one validation boundary;
- one concurrency model;
- one error surface;
- one testable behavior;
- one future migration path.

This directly applies the Cipher Core engineering principles of simplicity, clear responsibility, evidence-based validation, and minimal technical debt.

## Historical Significance

Theme Center RGB Bridge is the first production-quality subsystem completed under the Cipher Core Operating Manual.

It demonstrates the intended Cipher Core operating model:

- direct integration over automation hacks;
- lab-first engineering;
- explicit safety boundaries;
- provider-independent architecture;
- validated real-world outcomes;
- production review separated from production deployment.

The subsystem is:

**COMPLETE**

**LAB VALIDATED**

**READY FOR PRODUCTION REVIEW**

It is not production deployed.

## References

- [OpenRGB Effects Bridge specification](../../BRIDGES/OpenRGB.md)
- [Theme Center readiness note](../../BRIDGES/2026-07-05-theme-center-rgb-readiness.md)
- [Architecture decision](../../DECISIONS/2026-07-04-openrgb-bridge-v1.md)
- [Engineering standards](../../STANDARDS/ENGINEERING.md)
