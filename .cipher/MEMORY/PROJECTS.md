# Project Memory

Stores durable project context: objectives, boundaries, source-of-truth artifacts, environments, and known-good states.

## Entry requirements

- project name and scope;
- authoritative repository or workspace;
- current source of truth;
- production and lab boundaries;
- verified dependencies;
- active constraints;
- review date.

## Rules

- A project memory is not a substitute for repository documentation.
- Verify drift-prone paths, versions, and environment state before action.
- Preserve explicit source-of-truth declarations.
- Link architectural decisions to [DECISIONS/](../DECISIONS/README.md).

## Entries

Future project memory records belong here or in linked project-specific documents.
