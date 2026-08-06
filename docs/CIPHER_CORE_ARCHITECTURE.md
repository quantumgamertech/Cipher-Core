# Cipher Core Architecture

Status date: 2026-08-06

This document describes the active `C:\Cipher Core` filesystem. `C:\Cipher Core Backup` is historical recovery material and is not part of the active runtime.

## Runtime Diagram

```text
Kevin double-clicks Cipher Core.exe
        |
        v
.NET WinForms launcher
  - mutex: Local\CipherCoreLauncher
  - log: C:\Cipher Core\logs\launcher.log
  - starts dashboard runtime
  - polls http://127.0.0.1:5173/api/startup-gateway/status
  - opens http://127.0.0.1:5173/
  - hides to tray after readiness
        |
        v
Current dashboard runtime: Vite dev server on 127.0.0.1:5173
  - serves React dashboard
  - owns local API middleware
        |
        +--> Startup Gateway / Owner Access
        |      - /api/startup-gateway/status
        |      - /api/startup/status
        |      - /api/rgb/status
        |      - /api/startup-gateway/unlock
        |      - /api/startup-gateway/select
        |
        +--> Theme Center
        |      - /api/theme-center/status
        |      - /api/theme-center/apply
        |      - pipe: \\.\pipe\CipherCore.OpenRGBEffects.v1
        |      - AIDA pipe: \\.\pipe\CipherCore.AIDA64.v1
        |
        +--> Sensor Engine / Telemetry
        |      - /api/telemetry
        |      - sensor-worker.ps1
        |      - CipherPulse.Hardware.exe helper
        |
        +--> Voice
               - /api/voice/respond
               - /api/voice/speak
               - OpenAI Responses API
               - Fish Audio TTS when configured
```

## Subsystem Classification

| Subsystem | Classification | Notes |
| --- | --- | --- |
| Dashboard React UI | Working but development-bound | Production assets build successfully, but required APIs currently live in Vite middleware. |
| Vite dev runtime | Working but development-bound | Required for local APIs until a real production server is added. |
| .NET launcher | Working but development-bound | Starts `npm.cmd run dev`; tray and mutex behavior exist. |
| Startup Gateway | Production ready core, Lab-dependent hardware path | Safe/Live/Lab policy is explicit and tested. |
| Owner Access / ADMIN | Production ready local boundary | PIN remains backend-only and session is HttpOnly in server memory. |
| Live Mode | Production ready policy | Manual external RGB actions remain locked. |
| Lab Mode | Lab only | Validates Lab OpenRGB runtime, port `6743`, bridge DLL hash, and named pipe before enabling RGB writes. |
| Theme Center | Working but partly Lab only | UI works; real OpenRGB apply requires Lab authorization. AIDA64 bridge remains owner-gated. |
| Voice | Working but provider-dependent | Uses backend secrets for OpenAI/Fish Audio. Frontend handles simulation/live audio. |
| Telemetry | Working but local-hardware-dependent | Sensor worker and helper degrade honestly when native data is unavailable. |
| Production OpenRGB | Currently disabled | Service is stopped/disabled, no active scheduled task, no process, no listener on `6742`. |
| Lab OpenRGB | Lab only | Validated bridge plugin path exists under `OpenRGB_Motherboard_Bridge_Lab`. |
| Companion visual renderer | Currently disabled | Robot renderer was intentionally removed. State vocabulary remains. |
| Legacy Echo/material | Reference/deprecated | Do not delete during productionization. |

## Launcher Lifecycle

The launcher source is `C:\Cipher Core\launcher\Program.cs`. It builds a WinForms status window with a tray icon, holds a single-instance mutex named `Local\CipherCoreLauncher`, and writes `C:\Cipher Core\logs\launcher.log`.

Current runtime command:

```text
cmd.exe /d /s /c "npm.cmd run dev -- --host 127.0.0.1 --port 5173"
```

Working directory:

```text
C:\Cipher Core\dashboard
```

The launcher polls:

```text
http://127.0.0.1:5173/api/startup-gateway/status
```

If readiness succeeds, it opens:

```text
http://127.0.0.1:5173/
```

The launcher hides to the tray after readiness. Tray `Exit` stops only the launcher-owned dashboard process.

## Dashboard Lifecycle

Current package scripts in `C:\Cipher Core\dashboard\package.json`:

```text
npm.cmd run dev      -> vite
npm.cmd run build    -> vite build
npm.cmd run preview  -> vite preview
npm.cmd test         -> node --test
```

The current production build output is:

```text
C:\Cipher Core\dashboard\dist
```

However, `vite preview` is not a full production runtime because the required local APIs are mounted through Vite plugin middleware in `dashboard/vite.config.js`.

## Local API Composition

`dashboard/vite.config.js` currently constructs shared singleton runtime objects:

- `createStartupGateway()`
- `createOwnerAccess({ environment })`
- `new SensorEngine()`

Then mounts these Vite plugins:

- `startupGatewayApi(...)`
- `themeCenterApi(...)`
- `sensorEngineApi(...)`
- `voiceApi(...)`

Production hardening should reuse those modules instead of duplicating business logic.

## Startup Gateway

Source:

```text
C:\Cipher Core\dashboard\server\startupGateway.js
```

Modes:

- `safe`: hardware control disabled.
- `live`: normal daily local mode; manual external RGB actions locked.
- `lab`: owner-gated mode that can enable validated RGB writes.

Owner Access:

- Environment variable: `CIPHER_OWNER_PIN`
- Cookie: `CipherOwnerSession`
- Cookie attributes: `Path=/; HttpOnly; SameSite=Strict`
- Session storage: backend memory only.

## Theme Center and RGB

Source:

```text
C:\Cipher Core\dashboard\server\themeCenter.js
```

Theme registry:

```text
Default    -> LOAD Default
PurpleBlue -> LOAD PurpleBlue
Inferno    -> LOAD Inferno
Ice        -> LOAD Ice
Matrix     -> LOAD Matrix
Stealth    -> LOAD Stealth
```

OpenRGB bridge pipe:

```text
\\.\pipe\CipherCore.OpenRGBEffects.v1
```

AIDA64 bridge pipe:

```text
\\.\pipe\CipherCore.AIDA64.v1
```

Manual RGB writes are enabled only when `rgbActionsEnabled` is true. Live Mode keeps `rgbActionsEnabled=false`.

## OpenRGB Runtime

Production install:

```text
C:\Program Files\OpenRGB\OpenRGB.exe
C:\Program Files\OpenRGB\plugins\OpenRGBEffectsPlugin.dll
```

Production port:

```text
6742
```

Current production state from Phase 0:

- `OpenRGB` service is stopped and disabled.
- No `OpenRGB.exe` process was running.
- No listener was present on `6742` or `6743`.
- No active OpenRGB/Cipher scheduled task was found.
- Production plugin hash differed from the validated bridge plugin hash.

Lab runtime:

```text
C:\Cipher Core\OpenRGB_Motherboard_Bridge_Lab\20260704-183620\runtime\OpenRGB.exe
C:\Cipher Core\OpenRGB_Motherboard_Bridge_Lab\20260704-183620\runtime\plugins\OpenRGBEffectsPlugin.dll
C:\Cipher Core\OpenRGB_Motherboard_Bridge_Lab\20260704-183620\config
```

Lab port:

```text
6743
```

Validated bridge DLL hash:

```text
0BEF7C41742D2334819F6520EE10D2640DE1975655F12E02B30A20FD3790BF49
```

## Voice Runtime

Backend source:

```text
C:\Cipher Core\dashboard\server\voice.js
```

Endpoints:

- `POST /api/voice/respond`
- `POST /api/voice/speak`

Provider path:

```text
frontend microphone transcript
  -> /api/voice/respond
  -> OpenAI Responses API
  -> /api/voice/speak
  -> Fish Audio TTS when FISH_API_KEY and FISH_VOICE_ID are configured
  -> browser Audio playback
```

Environment variables:

- `OPENAI_API_KEY`
- `CIPHER_OPENAI_MODEL`
- `FISH_API_KEY`
- `FISH_VOICE_ID`
- `FISH_TTS_MODEL`

Secrets are used server-side only.

## Telemetry Runtime

Backend source:

```text
C:\Cipher Core\dashboard\server\sensorEngine.js
```

Endpoint:

```text
GET /api/telemetry
```

Worker/helper sources:

```text
C:\Cipher Core\dashboard\server\sensor-worker.ps1
C:\Cipher Core\dashboard\server\cipherPulseHardware.js
```

The sensor engine starts one PowerShell worker on Windows and stops it when the server closes. It also owns the `CipherPulseHardware` helper lifecycle.

## Ports

| Port | Owner | Current Use |
| --- | --- | --- |
| 5173 | Dashboard runtime | Vite dev server and future production local server. |
| 6742 | Production OpenRGB | Currently inactive; intended production OpenRGB server port. |
| 6743 | Lab OpenRGB | Owner-gated Lab runtime only. |

All Cipher Core local HTTP APIs must bind to `127.0.0.1` by default.

## Persistent State and Logs

Current persisted/browser state:

- Browser localStorage key `cipher.themeAppearance` stores locked local appearance only.
- Owner Access session is server memory plus HttpOnly browser cookie.

Current logs:

- `C:\Cipher Core\logs\launcher.log`
- `C:\Cipher Core\dashboard\lab-logs\` when applicable.

Planned production state policy:

- Runtime state should live under `C:\Cipher Core\state\`.
- Logs should live under `C:\Cipher Core\logs\`.
- Secrets must not be written to state or logs.

## Security Boundaries

- Dashboard HTTP server binds to `127.0.0.1`.
- Live Mode does not enable manual external RGB writes.
- Lab Mode requires Owner Access and validates the Lab OpenRGB runtime before enabling RGB writes.
- Owner PIN is read from the backend environment only.
- Local APIs are not designed for LAN or cloud exposure.
- Production server work must preserve endpoint contracts while keeping loopback binding.

## Generated and Ignored Outputs

Generated build output:

```text
C:\Cipher Core\dashboard\dist
C:\Cipher Core\dist
```

Generated backups and release outputs should remain ignored and should not be committed.

## Baseline Validation

Baseline commit:

```text
0f4087d6a1e8e23c27a4eca3fd29137ca83016e0
```

Phase 0 baseline validation:

- `npm.cmd test`: 111/111 passed.
- `npm.cmd run build`: passed, 72 modules transformed, 1.77 seconds measured wrapper time.

The only pre-existing dirty item was:

```text
C:\Cipher Core\OpenRGB_Production_Promotion_Backup\20260805-235458
```

It is an approved backup from the prior production bridge promotion attempt and is preserved.
