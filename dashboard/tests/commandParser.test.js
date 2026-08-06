import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedCommands, parseCommand } from '../src/services/commands/commandParser.js';

test('safe console exposes only the approved whitelist', () => {
  assert.deepEqual(allowedCommands, [
    'status',
    'open work mode',
    'open gaming mode',
    'run diagnostics',
    'show projects',
    'clear',
    'help',
  ]);
});

test('mode command returns an in-memory UI effect', () => {
  assert.deepEqual(parseCommand('  OPEN   GAMING MODE ').effect, {
    type: 'SET_OPERATOR_MODE',
    value: 'gaming',
  });
});

test('unknown commands do not return executable effects', () => {
  const result = parseCommand('delete everything');
  assert.equal(result.effect, undefined);
  assert.match(result.output, /Unknown command/);
});
