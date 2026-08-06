import { readTelemetry } from '../telemetry/telemetryService.js';
import { getThemeCenterStatus } from '../themes/themeCenterService.js';
import { getStartupGatewayStatus } from './startupGatewayService.js';

export const STARTUP_EVENTS = Object.freeze({
  ON_BOOT_BEGIN: 'ON_BOOT_BEGIN',
  ON_BOOT_COMPLETE: 'ON_BOOT_COMPLETE',
  ON_MODE_SELECTED: 'ON_MODE_SELECTED',
  ON_SYSTEM_READY: 'ON_SYSTEM_READY',
});

export const STARTUP_STEPS = Object.freeze([
  { id: 'core', label: 'Initializing Cipher Core...' },
  { id: 'gateway', label: 'Loading Startup Gateway...' },
  { id: 'companion', label: 'Loading Companion Interface...' },
  { id: 'pulse', label: 'Loading Cipher Pulse...' },
  { id: 'theme', label: 'Loading Theme Engine...' },
  { id: 'hardware', label: 'Checking Hardware...' },
  { id: 'bridge', label: 'Checking RGB Bridge...' },
  { id: 'ready', label: 'Ready.' },
]);

export const STARTUP_MINIMUM_DURATION_MS = 4_000;
export const STARTUP_READY_HOLD_MS = 1_500;

export function getStartupReadyDelay(elapsedMs) {
  return Math.max(
    0,
    STARTUP_MINIMUM_DURATION_MS - STARTUP_READY_HOLD_MS - Math.max(0, elapsedMs),
  );
}

export function createStartupEventBus() {
  const listeners = new Map();
  return {
    subscribe(eventName, listener) {
      const eventListeners = listeners.get(eventName) ?? new Set();
      eventListeners.add(listener);
      listeners.set(eventName, eventListeners);
      return () => eventListeners.delete(listener);
    },
    emit(eventName, detail = {}) {
      (listeners.get(eventName) ?? []).forEach((listener) => listener(detail));
    },
  };
}

export const startupEvents = createStartupEventBus();

export async function runStartupInitialization({
  getGatewayStatus = getStartupGatewayStatus,
  getPulseSnapshot = readTelemetry,
  getThemeStatus = getThemeCenterStatus,
  onStep = () => {},
} = {}) {
  const results = {};
  const update = (id, state, message) => {
    results[id] = { id, state, message };
    onStep(results[id]);
  };

  update('core', 'active', 'Local interface online');
  update('core', 'complete', 'Core interface ready');

  let gatewayStatus;
  update('gateway', 'active', 'Reading startup policy');
  try {
    gatewayStatus = await getGatewayStatus();
    update('gateway', 'complete', 'Safe policy loaded');
  } catch (error) {
    update('gateway', 'error', error.message);
    return { ready: false, gatewayStatus: null, steps: { ...results }, error };
  }

  update('companion', 'active', 'Binding Companion interface');
  update('companion', 'complete', 'Companion Interface ready');

  update('pulse', 'active', 'Reading Sensor Engine');
  try {
    const pulse = await getPulseSnapshot();
    update('pulse', pulse.status === 'error' ? 'warning' : 'complete', `Cipher Pulse ${pulse.status}`);
  } catch {
    update('pulse', 'warning', 'Cipher Pulse unavailable');
  }

  update('theme', 'active', 'Reading theme policy');
  try {
    const theme = await getThemeStatus();
    update('theme', 'complete', theme.realActionsEnabled ? 'Theme Engine armed' : 'Theme Engine safe');
  } catch {
    update('theme', 'warning', 'Theme Engine unavailable');
  }

  update('hardware', 'active', 'Reading hardware policy');
  update('hardware', 'complete', 'Hardware control locked until mode selection');

  update('bridge', 'active', 'Reading bridge policy');
  update(
    'bridge',
    'complete',
    gatewayStatus.labReady ? 'Validated RGB bridge ready' : 'Bridge validation deferred to Lab Mode',
  );

  update('ready', 'complete', 'Startup Gateway ready');
  return { ready: true, gatewayStatus, steps: { ...results }, error: null };
}
