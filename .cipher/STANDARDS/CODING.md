# Coding Standard

This standard applies when runtime implementation is separately authorized.

## Design

- Keep modules cohesive and interfaces narrow.
- Prefer explicit dependencies over hidden global state.
- Separate policy, orchestration, transport, and presentation.
- Avoid duplicate active execution paths.
- Make state ownership clear.
- Keep provider-specific logic behind adapters.

## Reliability

- Validate all external input.
- Bound waits, retries, buffers, and concurrency.
- Use locks or idempotency where duplicate execution is harmful.
- Return structured errors with exact failed steps.
- Never silently fall back to destructive behavior.
- Preserve application-owned configuration unless mutation is required and approved.

## Testability

- Inject external boundaries where practical.
- Test dry-run and live paths separately.
- Cover success, rejection, unavailable dependencies, timeout, and concurrency.
- Verify observable outcomes, not only return codes.
- Keep tests deterministic and isolated from production.

## Observability

- Log action, target, origin, timestamp, and result.
- Never log secrets.
- Use stable event names suitable for diagnosis.
- Preserve enough evidence to distinguish repeated requests from repeated execution.

## Change discipline

- Make focused changes.
- Preserve unrelated user work.
- Update relevant manuals and ADRs.
- Run checks proportional to risk.
- Do not deploy or commit without authorization.
