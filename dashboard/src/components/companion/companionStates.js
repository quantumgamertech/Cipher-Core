export const COMPANION_STATES = Object.freeze({
  DORMANT: 'dormant',
  ACTIVATING: 'activating',
  BOOTING: 'booting',
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  SMIRK: 'smirk',
  HAPPY: 'happy',
  SUCCESS: 'success',
  WARNING: 'warning',
  ALERT: 'alert',
  ERROR: 'error',
  SLEEP: 'sleep',
});

export const COMPANION_STATE_LIST = Object.freeze(Object.values(COMPANION_STATES));

const implementedVisualStates = Object.freeze({
  [COMPANION_STATES.DORMANT]: 'dormant',
  [COMPANION_STATES.ACTIVATING]: 'activating',
  [COMPANION_STATES.BOOTING]: 'booting',
  [COMPANION_STATES.IDLE]: 'idle',
  [COMPANION_STATES.LISTENING]: 'listening',
  [COMPANION_STATES.THINKING]: 'thinking',
  [COMPANION_STATES.SPEAKING]: 'speaking',
  [COMPANION_STATES.SMIRK]: 'smirk',
  [COMPANION_STATES.ALERT]: 'alert',
});

export function normalizeCompanionState(state) {
  const normalized = String(state ?? '').trim().toLowerCase();
  return COMPANION_STATE_LIST.includes(normalized) ? normalized : COMPANION_STATES.IDLE;
}

export function isCompanionStateImplemented(state) {
  return Object.hasOwn(implementedVisualStates, normalizeCompanionState(state));
}

export function getCompanionVisualState(state) {
  const normalized = normalizeCompanionState(state);
  return implementedVisualStates[normalized] ?? implementedVisualStates[COMPANION_STATES.IDLE];
}

export function mapCoreModeToCompanionState(mode) {
  switch (mode) {
    case 'dormant':
      return COMPANION_STATES.DORMANT;
    case 'activating':
      return COMPANION_STATES.ACTIVATING;
    case 'booting':
    case 'boot':
      return COMPANION_STATES.BOOTING;
    case 'listening':
      return COMPANION_STATES.LISTENING;
    case 'thinking':
      return COMPANION_STATES.THINKING;
    case 'speaking':
      return COMPANION_STATES.SPEAKING;
    case 'alert':
      return COMPANION_STATES.ALERT;
    case 'smirk':
      return COMPANION_STATES.SMIRK;
    default:
      return COMPANION_STATES.IDLE;
  }
}
