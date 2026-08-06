# Naming Standard

Names are part of the architecture. They must communicate role, scope, and stability.

## Canonical product names

- **Cipher Core** — the platform and operating system
- **Cipher** — the intelligence and permanent identity
- **Companion** — Cipher's default visual presence
- **Identity Layer** — appearance, voice, and presentation subsystem
- **Skill** — a governed modular capability
- **Bridge** — a direct external integration
- **Chronicle** — permanent engineering history

Do not use these terms interchangeably.

## General rules

- Prefer clear words over abbreviations.
- Use one stable name for each concept.
- Avoid provider names in provider-independent interfaces.
- Include a version in external protocol endpoints.
- Use action-oriented command names.
- Avoid decorative characters in machine-facing names.
- Preserve established casing in product names.

## Files

- Foundational manuals use uppercase Markdown names.
- Directories representing subsystems use uppercase names.
- ADR files use `YYYY-MM-DD-short-decision-name.md`.
- Bridge documents use the external system's recognizable product name.

## Protocols

Protocol names must identify ownership, target, and version.

Example:

`\\.\pipe\CipherCore.OpenRGBEffects.v1`

Commands use uppercase verbs followed by validated arguments:

`LOAD Inferno`
