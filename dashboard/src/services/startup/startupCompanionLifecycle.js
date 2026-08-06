import { COMPANION_STATES } from '../../components/companion/companionStates.js';

export const STARTUP_COMPANION_WAKE_TIMING = Object.freeze({
  standard: Object.freeze({
    dormantHoldMs: 700,
    activatingMs: 900,
    bootingMs: 1_200,
    idleSettleMs: 300,
  }),
  reducedMotion: Object.freeze({
    dormantHoldMs: 220,
    activatingMs: 240,
    bootingMs: 320,
    idleSettleMs: 120,
  }),
});

export function getStartupCompanionWakeTimeline({ reducedMotion = false } = {}) {
  const timing = reducedMotion
    ? STARTUP_COMPANION_WAKE_TIMING.reducedMotion
    : STARTUP_COMPANION_WAKE_TIMING.standard;

  return [
    { state: COMPANION_STATES.DORMANT, durationMs: timing.dormantHoldMs },
    { state: COMPANION_STATES.ACTIVATING, durationMs: timing.activatingMs },
    { state: COMPANION_STATES.BOOTING, durationMs: timing.bootingMs },
    { state: COMPANION_STATES.IDLE, durationMs: timing.idleSettleMs },
  ];
}

export function getStartupCompanionWakeTotalMs(options) {
  return getStartupCompanionWakeTimeline(options)
    .reduce((total, step) => total + step.durationMs, 0);
}
