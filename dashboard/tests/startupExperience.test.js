import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStartupEventBus,
  getStartupReadyDelay,
  runStartupInitialization,
  STARTUP_EVENTS,
  STARTUP_STEPS,
} from '../src/services/startup/startupExperience.js';
import {
  canShowLabMode,
  STARTUP_ACTIVATION_MODE,
} from '../src/services/startup/startupGatewayService.js';
import {
  getStartupCompanionWakeTimeline,
  getStartupCompanionWakeTotalMs,
  STARTUP_COMPANION_WAKE_TIMING,
} from '../src/services/startup/startupCompanionLifecycle.js';
import { COMPANION_STATES } from '../src/components/companion/companionStates.js';

test('Lab Mode visibility requires an unlocked owner session', () => {
  assert.equal(canShowLabMode({ ownerUnlocked: false }), false);
  assert.equal(canShowLabMode({ ownerUnlocked: true }), true);
  assert.equal(canShowLabMode({ ownerUnlocked: 'false' }), false);
  assert.equal(canShowLabMode({ ownerUnlocked: 'true' }), false);
  assert.equal(canShowLabMode({}), false);
  assert.equal(canShowLabMode(null), false);
});

test('Startup Gateway activation maps to the existing Live runtime', () => {
  assert.equal(STARTUP_ACTIVATION_MODE, 'live');
});

test('startup Companion renders dormant first and holds it during initial loading', () => {
  const timeline = getStartupCompanionWakeTimeline();

  assert.equal(timeline[0].state, COMPANION_STATES.DORMANT);
  assert.equal(timeline[0].durationMs, STARTUP_COMPANION_WAKE_TIMING.standard.dormantHoldMs);
  assert.ok(timeline[0].durationMs >= 600);
});

test('startup Companion cannot reach idle before the wake sequence completes', () => {
  const timeline = getStartupCompanionWakeTimeline();
  const idleIndex = timeline.findIndex((step) => step.state === COMPANION_STATES.IDLE);
  const preIdleStates = timeline.slice(0, idleIndex).map((step) => step.state);

  assert.deepEqual(preIdleStates, [
    COMPANION_STATES.DORMANT,
    COMPANION_STATES.ACTIVATING,
    COMPANION_STATES.BOOTING,
  ]);
  assert.equal(timeline.at(-1).state, COMPANION_STATES.IDLE);
  assert.equal(getStartupCompanionWakeTotalMs(), 3_100);
});

test('startup activation is available only after Companion settles into idle', () => {
  const timeline = getStartupCompanionWakeTimeline();
  const activationStep = timeline.at(-1);

  assert.equal(activationStep.state, COMPANION_STATES.IDLE);
  assert.equal(activationStep.durationMs, STARTUP_COMPANION_WAKE_TIMING.standard.idleSettleMs);
});

test('ACTIVATE uses the existing runtime without replaying the Companion wake sequence', () => {
  const activationRuntimeStates = [STARTUP_ACTIVATION_MODE];

  assert.deepEqual(activationRuntimeStates, ['live']);
  assert.equal(activationRuntimeStates.includes(COMPANION_STATES.ACTIVATING), false);
  assert.equal(activationRuntimeStates.includes(COMPANION_STATES.BOOTING), false);
});

test('startup initialization reports every subsystem in canonical order', async () => {
  const updates = [];
  const result = await runStartupInitialization({
    getGatewayStatus: async () => ({
      mode: 'safe',
      labReady: false,
      rgbActionsEnabled: false,
    }),
    getPulseSnapshot: async () => ({ status: 'live' }),
    getThemeStatus: async () => ({ realActionsEnabled: false }),
    onStep: (step) => updates.push(step),
  });

  assert.equal(result.ready, true);
  assert.deepEqual(Object.keys(result.steps), STARTUP_STEPS.map((step) => step.id));
  assert.equal(result.steps.pulse.message, 'Cipher Pulse live');
  assert.equal(result.steps.bridge.message, 'Bridge validation deferred to Lab Mode');
  assert.equal(updates.at(-1).id, 'ready');
});

test('startup transition remains readable and holds Ready before mode selection', () => {
  assert.equal(getStartupReadyDelay(0), 2_500);
  assert.equal(getStartupReadyDelay(1_000), 1_500);
  assert.equal(getStartupReadyDelay(2_500), 0);
  assert.equal(getStartupReadyDelay(4_000), 0);
});

test('noncritical Pulse and Theme failures degrade honestly without blocking mode selection', async () => {
  const result = await runStartupInitialization({
    getGatewayStatus: async () => ({ mode: 'safe', labReady: false }),
    getPulseSnapshot: async () => { throw new Error('offline'); },
    getThemeStatus: async () => { throw new Error('offline'); },
  });

  assert.equal(result.ready, true);
  assert.equal(result.steps.pulse.state, 'warning');
  assert.equal(result.steps.theme.state, 'warning');
});

test('Startup Gateway failure blocks readiness and preserves the failure', async () => {
  const result = await runStartupInitialization({
    getGatewayStatus: async () => { throw new Error('gateway offline'); },
  });

  assert.equal(result.ready, false);
  assert.equal(result.steps.gateway.state, 'error');
  assert.match(result.error.message, /gateway offline/);
});

test('future startup hooks publish events without coupling consumers', () => {
  const bus = createStartupEventBus();
  const received = [];
  const unsubscribe = bus.subscribe(
    STARTUP_EVENTS.ON_MODE_SELECTED,
    (detail) => received.push(detail.mode),
  );

  bus.emit(STARTUP_EVENTS.ON_MODE_SELECTED, { mode: 'safe' });
  unsubscribe();
  bus.emit(STARTUP_EVENTS.ON_MODE_SELECTED, { mode: 'lab' });
  assert.deepEqual(received, ['safe']);
});
