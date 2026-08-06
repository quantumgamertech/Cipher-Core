# Engineering Standard

## Principles

1. **Simplicity over cleverness.**  
   Choose the smallest design that clearly satisfies the requirement.

2. **One clean architecture.**  
   Remove competing active paths after a replacement is validated and approved.

3. **Clear responsibility.**  
   Every subsystem owns one coherent concern and exposes explicit boundaries.

4. **Bridges over automation hacks.**  
   Prefer native APIs, SDKs, and versioned IPC over UI automation.

5. **Production is sacred.**  
   Experiment in labs. Preserve known-good states and rollback assets.

6. **Evidence over guesses.**  
   Use logs, tests, hashes, observed state, and physical validation.

7. **Validate before claiming success.**  
   A command completing is not proof that the intended outcome occurred.

8. **Minimize technical debt.**  
   Do not keep temporary paths active without an owner and retirement plan.

9. **Document important decisions.**  
   Architecture must remain understandable after its original authors leave.

10. **Providers are replaceable.**  
    Keep platform contracts independent from model vendors.

## Delivery workflow

1. Define the objective and non-goals.
2. Identify the authoritative state and environment.
3. Reproduce the problem.
4. Instrument the failing boundary.
5. Implement the smallest durable correction.
6. Test expected behavior and failure behavior.
7. Validate the real outcome.
8. Document the decision and rollback.
9. Obtain production approval separately.

## Review questions

- Is there one authoritative path?
- Does each component have a clear owner and responsibility?
- Are inputs, outputs, failures, and side effects explicit?
- Is the design provider-independent where required?
- Are production boundaries and rollback clear?
- Has the real outcome been validated?
- Is the documentation updated without duplication?
