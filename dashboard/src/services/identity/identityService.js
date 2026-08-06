import { identities } from '../../data/identities.js';

export const DEFAULT_IDENTITY_ID = 'nexus';

export function getIdentity(identityId = DEFAULT_IDENTITY_ID) {
  return identities.find((identity) => identity.id === identityId) ??
    identities.find((identity) => identity.id === DEFAULT_IDENTITY_ID);
}

export function listPublicIdentities() {
  return identities.filter((identity) => identity.public);
}

export function canSelectIdentity(identityId, { founderMode = false } = {}) {
  const identity = identities.find((item) => item.id === identityId);
  if (!identity) return false;
  return identity.public || founderMode === true;
}

export function resolveIdentitySelection(identityId, options) {
  return canSelectIdentity(identityId, options) ? getIdentity(identityId) : getIdentity();
}

export function sanitizeAgentName(value, fallback = 'Cipher') {
  const cleaned = String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
  return cleaned || fallback;
}

export function createIdentityProfile({ identityId, agentName, purpose, business = {} }, options) {
  const identity = resolveIdentitySelection(identityId, options);
  return {
    identityId: identity.id,
    identityName: identity.name,
    agentName: sanitizeAgentName(agentName, identity.name),
    purpose: purpose || 'Personal Operator',
    business: Object.fromEntries(
      Object.entries(business).map(([key, value]) => [key, String(value ?? '').trim().slice(0, 240)]),
    ),
    prototype: true,
  };
}
