# Skills

Skills are modular, approved capabilities available to Cipher. A Skill describes what Cipher can do; it does not grant its own authority.

## Skill contract

Every Skill must define:

- purpose and supported operations;
- inputs and validation;
- outputs and structured errors;
- permissions and approval requirements;
- allowed environments;
- side effects;
- dependencies and Bridges used;
- verification;
- failure behavior;
- rollback or recovery.

## Lifecycle

1. **Proposed** — capability and risks documented
2. **Lab** — isolated implementation
3. **Validated** — automated and real-world checks passed
4. **Approved** — authorized for a defined scope
5. **Active** — available through policy-controlled execution
6. **Retired** — disabled with history preserved

## Rules

- Skills cannot exceed the active task's scope.
- Destructive behavior requires explicit design and approval.
- Dry-run support is preferred for state-changing Skills.
- Hidden fallback behavior is prohibited.
- Failures must identify the exact failed step.
- Skills must obey [SAFETY.md](../SAFETY.md).

## Skill documents

Future Skill documents belong in this directory and should use one file per stable capability contract.
