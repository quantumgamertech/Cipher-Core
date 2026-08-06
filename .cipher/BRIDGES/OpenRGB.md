# OpenRGB Effects Bridge v1.0

- **Status:** Stable in lab; production not deployed
- **Transport:** Windows named pipe
- **Endpoint:** `\\.\pipe\CipherCore.OpenRGBEffects.v1`
- **Owner:** Cipher Core Theme Center integration

## Commands

- `LOAD PurpleBlue`
- `LOAD Inferno`
- `LOAD Ice`
- `LOAD Matrix`
- `LOAD Stealth`

Success response:

`OK QUEUED`

Invalid themes return an explicit error.

## Behavior

The Bridge calls the OpenRGB Effects plugin's native profile load action on the Qt UI thread. Theme Center sends one command while live actions are enabled and remains dry-run when `ENABLE_THEME_ACTIONS=false`.

Duplicate same-profile requests are guarded without blocking legitimate switching between different profiles.

## Deliberately excluded

- OpenRGB restart or process-control apply path
- `EffectSettings.json` mutation
- SDK Packet 23
- UI automation
- AIDA64 control

## Validated artifact

`OpenRGBEffectsPlugin-CipherCoreBridge.dll`

SHA-256:

`0BEF7C41742D2334819F6520EE10D2640DE1975655F12E02B30A20FD3790BF49`

The DLL has no `Qt5Network.dll` dependency.

## Validation

- Build completed with zero detected compiler or linker errors.
- Automated tests passed: 46/46.
- One OpenRGB process.
- One Effects plugin DLL.
- PurpleBlue applied across all detected RGB hardware without flicker.
- Inferno applied across all detected RGB hardware without flicker.
- Theme Center returned `OK QUEUED` and displayed `Applied`.
- Theme apply changed zero configuration files.
- Production remained untouched.

## Compatibility and deployment

The Bridge requires a compatible Effects plugin build. Production promotion requires a separate approval, pre-deployment backup, compatibility verification, and rollback procedure.

See the [decision record](../DECISIONS/2026-07-04-openrgb-bridge-v1.md).
