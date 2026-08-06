# First Experience Prototype

The First Experience is a cinematic, local-state onboarding prototype inside Cipher Core. It demonstrates the intended customer journey without saving data or enabling permissions.

## Flow

1. Black pulse / first signal
2. “Hello.”
3. Teammate introduction and prototype boundary
4. Public identity selection
5. Customer-selected agent name
6. Purpose selection
7. Business context preview
8. Profile review
9. “I’m ready.”

## Identity policy

Public customers may select Nexus, Orion, Spectrum, Sentinel, Lumen, or Companion. They may rename the teammate, so public faces do not depend on a fixed “C” logo.

Echo appears as **Founder’s Edition — Reserved** and is disabled in public/customer mode. The identity service rejects an Echo selection unless an explicit internal `founderMode` option is provided. The current public UI never provides that option.

## Data behavior

- State lives only in the current React session.
- Reloading clears the prototype profile.
- No local storage, database, analytics, network request, or account connection is used.
- Business fields are preview inputs, not production data collection.
- The completion screen explicitly states that nothing was saved or connected.

## Future requirements

Before persistence is considered, Cipher needs organization isolation, retention and deletion rules, consent language, protected secret storage, permission scopes, audit events, and recovery behavior.
