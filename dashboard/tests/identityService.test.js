import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSelectIdentity,
  createIdentityProfile,
  listPublicIdentities,
  resolveIdentitySelection,
  sanitizeAgentName,
} from '../src/services/identity/identityService.js';

test('public identity list includes only active identities', () => {
  const identities = listPublicIdentities();
  assert.equal(identities.length, 6);
  assert.equal(identities.some((identity) => identity.id === 'companion'), true);
});

test('retired private identity falls back to the default identity', () => {
  assert.equal(canSelectIdentity('echo'), false);
  assert.equal(resolveIdentitySelection('echo').id, 'nexus');
});

test('founder mode does not restore retired private identity', () => {
  assert.equal(canSelectIdentity('echo', { founderMode: true }), false);
  assert.equal(resolveIdentitySelection('echo', { founderMode: true }).id, 'nexus');
});

test('agent names are local-safe, trimmed, and bounded', () => {
  assert.equal(sanitizeAgentName('  Nova   Prime  '), 'Nova Prime');
  assert.equal(sanitizeAgentName('<Cipher>'), 'Cipher');
  assert.equal(sanitizeAgentName(''), 'Cipher');
  assert.equal(sanitizeAgentName('x'.repeat(50)).length, 32);
});

test('profile creation falls back from reserved identity in public mode', () => {
  const profile = createIdentityProfile({
    identityId: 'echo',
    agentName: 'Atlas',
    purpose: 'Research',
    business: { name: 'Local Prototype' },
  });
  assert.equal(profile.identityId, 'nexus');
  assert.equal(profile.agentName, 'Atlas');
  assert.equal(profile.prototype, true);
});
