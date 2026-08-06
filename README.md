# Cipher Core

Cipher Core is Kevin's original, local-first desktop command center: a calm, cinematic interface designed to become a permission-aware workstation assistant without depending on cloud services.

**Current version:** v0.9 Pre-Awakening

v1.0 Awakening is intentionally not implemented.

The current experience includes the Cipher Core operating model, Startup Gateway, Cipher Presence, and live local telemetry.

## What works

- Animated Cipher presence with randomized blinking, eye tracking, particles, breathing glow, and mode effects
- Idle, Listening, Thinking, Speaking, and Alert visual states
- Voice Center with backend-only ElevenLabs speech and a safe local simulation fallback
- Work, Gaming, Client, Stream, Maintenance, and Night operator modes
- Live Cipher Pulse CPU, GPU, memory, disk, network, and session uptime telemetry
- Mock Hardware Bus and disconnected Integration Matrix
- Safe local console supporting:
  - `status`
  - `open work mode`
  - `open gaming mode`
  - `run diagnostics`
  - `show projects`
  - `clear`
  - `help`
- Version timeline and safe fallback UI
- Presence system with Companion as Cipher's default visual form
- Reserved Eyes and Voice Visualizer presentation modes
- Responsive top-monitor and standard-browser layouts

## Safety boundaries

Cipher Core currently does **not**:

- Record microphone audio or perform speech recognition
- Connect Gmail, Calendar, GitHub, Railway, Discord, or any external account
- Read or control real PC hardware
- Execute shell commands
- Store API keys or secrets
- Deploy, expose a remote server, or require administrator access

Hardware state, integrations, and commands remain simulated unless an explicitly authorized subsystem is active. Voice calls ElevenLabs only when its backend environment is configured; otherwise it remains in local simulation mode.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

### Windows launcher

Double-click `Launch Cipher Core.bat` in the project root. The launcher:

- starts the dashboard at `http://127.0.0.1:5173/`;
- opens the browser after the local server is ready;
- always starts with RGB and AIDA64 actions disabled;
- avoids starting a duplicate when port 5173 is already running; and
- leaves the server attached to the launcher window so `Ctrl+C` stops it.

The equivalent PowerShell command is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Cipher Core\scripts\launch-cipher-core.ps1"
```

Safe defaults:

```text
ENABLE_THEME_ACTIONS=false
ENABLE_AIDA64_THEME_ACTIONS=false
```

After startup, Cipher Core's Startup Gateway presents Safe, Live, and owner-gated Lab modes. Safe Mode performs no hardware control. Live Mode is the normal daily local experience with Companion, telemetry, configured voice features, and Theme Center available while external actions remain locked. Lab Mode validates process isolation, the approved bridge DLL, port 6743, and the named pipe before enabling its isolated RGB bridge.

The launcher does not install dependencies, deploy, or modify OpenRGB or AIDA64 configuration. It never stops a running OpenRGB process.

Lab Mode is available only after local Owner Access is unlocked. Configure a PIN in the environment before launching Cipher Core:

```powershell
$env:CIPHER_OWNER_PIN = "choose-a-local-pin"
& "C:\Cipher Core\Launch Cipher Core.bat"
```

For normal double-click use, configure `CIPHER_OWNER_PIN` as a Windows user environment variable before launching. The PIN is read by the local backend, is never embedded in frontend code, and is not stored in browser localStorage. Owner authorization lasts only for the current browser/server session.

### Manual launch

```powershell
cd "C:\Cipher Core\dashboard"
npm install
npm.cmd run dev -- --port 5173
```

Open `http://127.0.0.1:5173`.

Other commands:

```powershell
npm run check
npm run test
npm run build
npm run preview
```

## Fullscreen and top-monitor use

1. Open the local dashboard in a browser.
2. Move the browser window to the top monitor.
3. Press `F11` for browser fullscreen.
4. Press `F11` again to exit.

No kiosk, startup, or display-setting changes are made automatically.

## Structure

```text
Cipher Core/
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   │   ├── console/
│   │   │   ├── integrations/
│   │   │   ├── layout/
│   │   │   ├── modes/
│   │   │   └── panels/
│   │   ├── config/
│   │   ├── data/
│   │   ├── hooks/
│   │   └── services/
│   │       ├── commands/
│   │       ├── hardware/
│   │       ├── integrations/
│   │       ├── telemetry/
│   │       └── voice/
│   └── assets/
├── brain/
├── config/
├── docs/
├── hardware/
├── lcd/
├── logs/
├── streamdeck/
├── CHANGELOG.md
└── PRE_AWAKENING_CHECKLIST.md
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Presence subsystem](.cipher/IDENTITY.md)
- [Roadmap](docs/ROADMAP.md)
- [Version Plan](docs/VERSION_PLAN.md)
- [Voice Plan](docs/VOICE_PLAN.md)
- [Telemetry Plan](docs/TELEMETRY_PLAN.md)
- [Hardware Bus](docs/HARDWARE_BUS.md)
- [Stream Deck Plan](docs/STREAMDECK_PLAN.md)
- [Changelog](CHANGELOG.md)
- [Pre-Awakening Checklist](PRE_AWAKENING_CHECKLIST.md)
- [Cipher Company Library](company/INDEX.md)
