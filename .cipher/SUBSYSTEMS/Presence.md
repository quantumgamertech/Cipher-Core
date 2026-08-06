# Companion Presence

## Purpose

Companion Presence gives Cipher's existing visual avatar quiet, believable awareness. It is presentation behavior only: it does not create a second intelligence, alter Cipher's identity, or modify memory.

Status: **LAB IMPLEMENTATION**

## Architecture

```text
Pointer, focus, and activity events
              |
              v
       Presence Engine
              |
      normalized state
              |
              v
    Companion renderer
```

The Presence Engine owns cursor targets, interpolation, blink scheduling, micro-expression scheduling, idle awareness, and presentation state. The React components render the state and never query operating-system telemetry or implement independent behavior schedules.

The engine exposes bounded pure functions for planning and interpolation. The UI hook owns browser event wiring and one `requestAnimationFrame` loop. High-frequency movement is applied through CSS custom properties, avoiding React renders and layout reads on every frame.

## Animation Rules

- Eyes lead cursor movement; the head follows with slower exponential interpolation.
- Head yaw is capped at 12 degrees and pitch at 8 degrees.
- Blinks occur every 2–7 seconds, last 100–180 milliseconds, and occasionally double.
- Breathing remains a subtle transform on the unmodified source artwork.
- Micro-expressions occur every 20–60 seconds and return to neutral.
- Idle awareness progresses at 30, 60, and 90 seconds without speech or notifications.
- Focus recovery returns gaze toward center.
- Movement uses transforms and opacity only. It must not cause layout thrashing.
- No animation may redraw, replace, or distort Companion's identity artwork.

Because Companion is currently rendered from a unified raster frame sequence, chest, shoulders, eyes, and mouth are not independent anatomical layers. Presence v1 therefore uses restrained whole-artwork breathing and parallax instead of inventing facial geometry.

## Future Event Model

Future states may request presentation intents such as `listening`, `thinking`, `speaking`, `celebration`, `warning`, `theme-reaction`, or `telemetry-reaction`. Those requests must enter through the Presence Engine, be prioritized, remain bounded, and return naturally to neutral.

Future consumers must not manipulate Companion animation classes or timers directly.

## Safety and Performance

- Lab-first validation is required before production review.
- The existing artwork remains the source of truth.
- One animation frame loop owns continuous motion.
- Pointer events are passive.
- The loop performs no geometry reads and writes only transform-related CSS variables.
- Unmount cleanup removes every timer, listener, and animation frame.

## Related Documents

- [Identity](../IDENTITY.md)
- [Architecture](../ARCHITECTURE.md)
- [Safety](../SAFETY.md)
- [Engineering Standard](../STANDARDS/ENGINEERING.md)
