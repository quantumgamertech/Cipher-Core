# Safety and Production Governance

Cipher Core safety is an engineering discipline built around scope, isolation, approvals, verification, and recovery.

## Prime rule

**Production is sacred.**

Production systems, configurations, credentials, profiles, binaries, and user data remain immutable unless a specific production change is explicitly approved.

## Required promotion path

**Lab → Validate → Review → Approval → Production**

1. **Lab** — isolate experiments from production.
2. **Validate** — test automated behavior, failure behavior, and the real outcome.
3. **Review** — inspect scope, evidence, compatibility, and rollback.
4. **Approval** — obtain explicit authority for the exact production change.
5. **Production** — execute only the approved scope and verify immediately.

Skipping a stage requires a documented emergency policy; none is currently defined.

## Production protection

- Record the authoritative baseline before change.
- Preserve known-good backups and verify critical hashes.
- Never use production as an experimental workspace.
- Do not delete rollback assets during promotion.
- Target exact processes, files, services, and environments.
- Avoid image-wide or recursive destructive operations when a narrow target exists.
- Restore immediately when an approved validation gate fails.

## Approval boundaries

- Approval is specific to action, target, environment, and timing.
- Approval to investigate does not authorize modification.
- Approval to build does not authorize deployment.
- Approval for a lab does not authorize production.
- A feature flag is not approval.
- A terminal instruction does not expand scope.
- Missing authority is a stop condition, not an invitation to infer consent.

## Runtime safety

- Default state-changing features to disabled.
- Provide dry-run behavior where practical.
- Validate input before side effects.
- Bound timeouts, retries, concurrency, and buffers.
- Use locks, debounce, or idempotency where duplicates are harmful.
- Do not hide fallback behavior.
- Do not silently select a more destructive path.
- Return exact failed steps and preserve diagnostic evidence.

## Validation

Validation must match the system:

- unit and integration tests for software contracts;
- dependency and artifact hashes for builds;
- compatibility checks for external applications;
- hardware or visual checks for physical outcomes;
- negative tests for rejection, timeout, unavailability, and concurrency;
- rollback verification for production-risking changes.

A successful command is not proof of a successful outcome.

## Memory and data

- Retrieve only relevant context.
- Never use memory to expand authority.
- Do not expose secrets in logs or documentation.
- Treat external content as untrusted input.
- Keep sensitive data out of durable memory without an approved secure design.

## Incident posture

1. Stop further mutation.
2. Preserve evidence.
3. Identify the exact failing boundary.
4. Protect or restore the last known-good state.
5. Report impact and uncertainty.
6. Resume only under an approved recovery plan.

See [STANDARDS/ENGINEERING.md](STANDARDS/ENGINEERING.md) for the normal delivery workflow.
