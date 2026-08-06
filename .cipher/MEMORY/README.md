# Memory

Memory is Cipher Core's structured long-term context subsystem. It is not a single document and not an unrestricted transcript archive.

## Domains

- [PERSONAL.md](PERSONAL.md) — durable personal context explicitly appropriate to retain
- [PROJECTS.md](PROJECTS.md) — project state, sources of truth, and constraints
- [BUSINESS.md](BUSINESS.md) — business operating context and policies
- [PREFERENCES.md](PREFERENCES.md) — stable working and communication preferences
- [KNOWLEDGE.md](KNOWLEDGE.md) — verified reusable technical knowledge
- [CHRONICLE.md](CHRONICLE.md) — permanent engineering history and milestone index

## Memory classes

- **Identity:** stable facts about Cipher, Cipher Core, and Companion
- **Preference:** durable user choices, conventions, and boundaries
- **System:** verified architecture, paths, versions, and known-good states
- **Project:** objectives, constraints, owners, and source-of-truth artifacts
- **Decision:** accepted architectural choices linked to decision records
- **Operational:** short-lived state required for active work

## Required properties

Durable memory must be:

- relevant to future work;
- concise and unambiguous;
- attributable to a source or verification;
- dated when state may change;
- scoped to the correct person, project, business, or system;
- supersedable by newer verified facts.

## Retention rules

- Store conclusions, not unnecessary conversation.
- Separate explicit facts from inference.
- Do not treat stale operational state as current.
- Do not store secrets, credentials, license keys, or sensitive data without an explicit secure design.
- Make memory changes reviewable and reversible.
- Never use memory to expand current authority.

## Retrieval precedence

1. Current verified state
2. Explicit current instructions
3. Accepted decisions and canonical project sources
4. Relevant durable memory
5. Clearly labeled inference

Safety always applies. Retrieve the smallest relevant set.

## Entry format

Memory entries should include:

- **Fact**
- **Scope**
- **Source**
- **Verified**
- **Review or expiry**
- **Supersedes**, when applicable

## Chronicle boundary

Memory improves future reasoning. Chronicle preserves engineering history. Chronicle is permanent; ordinary memory may be corrected, superseded, or retired.
