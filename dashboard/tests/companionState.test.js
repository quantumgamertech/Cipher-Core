import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  COMPANION_STATES,
  COMPANION_STATE_LIST,
  getCompanionVisualState,
  isCompanionStateImplemented,
  mapCoreModeToCompanionState,
  normalizeCompanionState,
} from '../src/components/companion/companionStates.js';
const appSource = () => readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const companionSource = () => readFileSync(new URL('../src/components/companion/Companion.jsx', import.meta.url), 'utf8');
const stylesSource = () => readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('Companion exposes the planned state vocabulary', () => {
  assert.deepEqual(COMPANION_STATE_LIST, [
    'dormant',
    'activating',
    'booting',
    'idle',
    'listening',
    'thinking',
    'speaking',
    'smirk',
    'happy',
    'success',
    'warning',
    'alert',
    'error',
    'sleep',
  ]);
});

test('Companion normalizes unknown state requests to Idle', () => {
  assert.equal(normalizeCompanionState('thinking'), COMPANION_STATES.THINKING);
  assert.equal(normalizeCompanionState(' THINKING '), COMPANION_STATES.THINKING);
  assert.equal(normalizeCompanionState('unknown'), COMPANION_STATES.IDLE);
  assert.equal(normalizeCompanionState(null), COMPANION_STATES.IDLE);
});

test('Companion implements startup and expression visual states', () => {
  assert.equal(isCompanionStateImplemented(COMPANION_STATES.DORMANT), true);
  assert.equal(isCompanionStateImplemented(COMPANION_STATES.ACTIVATING), true);
  assert.equal(isCompanionStateImplemented(COMPANION_STATES.BOOTING), true);
  assert.equal(isCompanionStateImplemented(COMPANION_STATES.IDLE), true);
  assert.equal(isCompanionStateImplemented(COMPANION_STATES.THINKING), true);
  assert.equal(isCompanionStateImplemented(COMPANION_STATES.SMIRK), true);
  assert.equal(getCompanionVisualState(COMPANION_STATES.IDLE), COMPANION_STATES.IDLE);
  assert.equal(getCompanionVisualState(COMPANION_STATES.THINKING), COMPANION_STATES.THINKING);
  assert.equal(getCompanionVisualState(COMPANION_STATES.SUCCESS), COMPANION_STATES.IDLE);
});

test('core modes map into Companion state requests without owning animation logic', () => {
  assert.equal(mapCoreModeToCompanionState('idle'), COMPANION_STATES.IDLE);
  assert.equal(mapCoreModeToCompanionState('dormant'), COMPANION_STATES.DORMANT);
  assert.equal(mapCoreModeToCompanionState('activating'), COMPANION_STATES.ACTIVATING);
  assert.equal(mapCoreModeToCompanionState('boot'), COMPANION_STATES.BOOTING);
  assert.equal(mapCoreModeToCompanionState('listening'), COMPANION_STATES.LISTENING);
  assert.equal(mapCoreModeToCompanionState('thinking'), COMPANION_STATES.THINKING);
  assert.equal(mapCoreModeToCompanionState('speaking'), COMPANION_STATES.SPEAKING);
  assert.equal(mapCoreModeToCompanionState('alert'), COMPANION_STATES.ALERT);
  assert.equal(mapCoreModeToCompanionState('custom'), COMPANION_STATES.IDLE);
});

test('Companion runtime is independent of image assets', () => {
  const source = companionSource();

  assert.doesNotMatch(source, /<img/);
  assert.doesNotMatch(source, /cipher-companion/);
  assert.doesNotMatch(source, /\/assets\/companion/);
});

test('Companion runtime does not render full-body expression overlays', () => {
  const source = companionSource();

  assert.doesNotMatch(source, /companion-expression/);
  assert.doesNotMatch(source, /companion-asset/);
  assert.doesNotMatch(source, /getCompanionExpressionAsset/);
  assert.doesNotMatch(source, /isCompanionExpressionEnabled/);
});

test('dormant and initializing states stay on the single startup body layer', () => {
  const source = companionSource();

  assert.equal(getCompanionVisualState(COMPANION_STATES.DORMANT), COMPANION_STATES.DORMANT);
  assert.equal(getCompanionVisualState(COMPANION_STATES.ACTIVATING), COMPANION_STATES.ACTIVATING);
  assert.equal(getCompanionVisualState(COMPANION_STATES.BOOTING), COMPANION_STATES.BOOTING);
  assert.doesNotMatch(source, /COMPANION_IDLE_BLINK/);
});

test('manual and real listening states use the canonical Companion state only', () => {
  assert.equal(mapCoreModeToCompanionState('listening'), COMPANION_STATES.LISTENING);
  assert.equal(getCompanionVisualState(COMPANION_STATES.LISTENING), COMPANION_STATES.LISTENING);
});

test('manual and real thinking states use the canonical Companion state only', () => {
  assert.equal(mapCoreModeToCompanionState('thinking'), COMPANION_STATES.THINKING);
  assert.equal(getCompanionVisualState(COMPANION_STATES.THINKING), COMPANION_STATES.THINKING);
});

test('CORE MODE remains in the center column without a Companion mount point', () => {
  const source = appSource();
  const centerColumn = source.slice(
    source.indexOf('<section className="core-column">'),
    source.indexOf('<aside className="column right-column">'),
  );
  const headingIndex = centerColumn.indexOf('CIPHER NEURAL INTERFACE');
  const modePanelIndex = centerColumn.indexOf('<ModePanel activeMode={mode} onChange={setMode} />');

  assert.ok(headingIndex < modePanelIndex);
  assert.equal(centerColumn.includes('<Companion'), false);
  assert.equal(centerColumn.includes('companion-stage'), false);
});

test('CORE MODE manual buttons keep driving canonical modes without a visual Companion', () => {
  const source = appSource();

  assert.match(source, /<ModePanel activeMode=\{mode\} onChange=\{setMode\} \/>/);
  assert.doesNotMatch(source, /mapCoreModeToCompanionState/);
  assert.equal(mapCoreModeToCompanionState('idle'), COMPANION_STATES.IDLE);
  assert.equal(mapCoreModeToCompanionState('listening'), COMPANION_STATES.LISTENING);
  assert.equal(mapCoreModeToCompanionState('thinking'), COMPANION_STATES.THINKING);
});

test('Companion renderer intentionally produces no visual robot markup', () => {
  const source = companionSource();

  assert.match(source, /return null;/);
  assert.doesNotMatch(source, /className=["']companion/);
  assert.doesNotMatch(source, /companion-shell/);
  assert.doesNotMatch(source, /companion-propulsion/);
  assert.doesNotMatch(source, /companion-thruster/);
});

test('Startup Gateway keeps lifecycle timing without a rendered Companion body', () => {
  const source = readFileSync(new URL('../src/components/startup/StartupGateway.jsx', import.meta.url), 'utf8');

  assert.match(source, /getStartupCompanionWakeTimeline/);
  assert.match(source, /setCompanionWakeComplete\(true\)/);
  assert.match(source, /disabled=\{!companionWakeComplete \|\| activationPending\}/);
  assert.doesNotMatch(source, /<Companion/);
  assert.doesNotMatch(source, /startup-stage/);
  assert.doesNotMatch(source, /mapCoreModeToCompanionState/);
});

test('retired Companion visual CSS cannot render a fallback robot', () => {
  const styles = stylesSource();

  assert.doesNotMatch(styles, /\.companion\s*\{/);
  assert.doesNotMatch(styles, /\.companion-stage/);
  assert.doesNotMatch(styles, /\.startup-stage/);
  assert.doesNotMatch(styles, /\.companion-shell/);
  assert.doesNotMatch(styles, /\.companion-propulsion/);
  assert.doesNotMatch(styles, /\.companion-thruster/);
  assert.doesNotMatch(styles, /@keyframes companion-shell-wake/);
});

test('SPEAKING and ALERT do not receive invented expression or robot assets', () => {
  const source = companionSource();

  assert.equal(mapCoreModeToCompanionState('speaking'), COMPANION_STATES.SPEAKING);
  assert.equal(mapCoreModeToCompanionState('alert'), COMPANION_STATES.ALERT);
  assert.doesNotMatch(source, /COMPANION_EXPRESSION_KEYS/);
  assert.doesNotMatch(source, /<img/);
});
