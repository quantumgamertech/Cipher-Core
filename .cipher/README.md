# Cipher Core Operating Manual

This directory is the canonical source of truth for Cipher Core's identity, architecture, engineering rules, safety model, and recorded decisions.

It is written for every engineer and every AI contributor. Runtime behavior must conform to this manual. Documentation does not itself grant runtime authority.

## Start here

1. [CIPHER_CORE.md](CIPHER_CORE.md) — mission, philosophy, and canonical definitions
2. [CORE.md](CORE.md) — Cipher's intelligence and execution architecture
3. [IDENTITY.md](IDENTITY.md) — Cipher, Companion, and the Identity Layer
4. [ARCHITECTURE.md](ARCHITECTURE.md) — platform subsystems and boundaries
5. [SAFETY.md](SAFETY.md) — production protection and approval rules
6. [STANDARDS/ENGINEERING.md](STANDARDS/ENGINEERING.md) — engineering doctrine

## Subsystems

- [Memory](MEMORY/README.md) — structured long-term context
- [Skills](SKILLS/README.md) — governed modular capabilities
- [Bridges](BRIDGES/README.md) — direct application and system integrations
- [Decisions](DECISIONS/README.md) — permanent architectural decision records
- [Standards](STANDARDS/README.md) — engineering, naming, and coding standards
- [Roadmap](ROADMAP.md) — long-term direction without provider lock-in

## Authority

When documents conflict, use this order:

1. [SAFETY.md](SAFETY.md)
2. [CIPHER_CORE.md](CIPHER_CORE.md)
3. Accepted records in [DECISIONS/](DECISIONS/README.md)
4. [ARCHITECTURE.md](ARCHITECTURE.md) and subsystem manuals
5. [STANDARDS/](STANDARDS/README.md)
6. [ROADMAP.md](ROADMAP.md)

Current explicit task instructions may narrow permitted work but cannot silently weaken safety or expand authority.

## Change policy

- Keep each rule in one authoritative document and link to it elsewhere.
- Record consequential architectural changes in `DECISIONS/`.
- Record validated milestones in [MEMORY/CHRONICLE.md](MEMORY/CHRONICLE.md).
- Update navigation when adding, renaming, or retiring documents.
- Preserve history; supersede decisions instead of rewriting their original context.
- Documentation changes require review. Runtime changes require separate authorization.

## Status

This is a living operating manual. It is provider-independent by design and intended to remain valid as implementations evolve.
