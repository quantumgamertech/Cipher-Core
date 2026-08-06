# Cipher Core Intelligence Architecture

Cipher's intelligence is an orchestration architecture, not a single model, process, or vendor.

Canonical identity definitions live in [CIPHER_CORE.md](CIPHER_CORE.md) and [IDENTITY.md](IDENTITY.md).

## Layers

1. **Identity layer**  
   Maintains Cipher's stable identity and delegates appearance, voice, and presentation to the Identity Layer without changing memory or personality.

2. **Reasoning layer**  
   Selects an appropriate provider or local engine for planning, analysis, and generation. Providers are replaceable resources.

3. **Context layer**  
   Combines the active conversation, verified system state, relevant [Memory](MEMORY/README.md), and task constraints.

4. **Policy layer**  
   Applies [Safety](SAFETY.md), approval requirements, environment separation, and action scope.

5. **Capability layer**  
   Exposes approved [Skills](SKILLS/README.md) and [Bridges](BRIDGES/README.md) through explicit contracts.

6. **Presence layer**  
   Presents Cipher through Companion, voice, text, status, and future interfaces without creating another intelligence.

## Execution cycle

1. Understand the objective, environment, and constraints.
2. Retrieve only relevant context and memory.
3. Establish verified current state.
4. Form a bounded plan.
5. Select approved Skills or Bridges.
6. Require approval where policy demands it.
7. Execute with observable status and structured errors.
8. Verify the real outcome.
9. Record durable knowledge or decisions when authorized.

## Provider boundary

OpenAI, Anthropic, local models, and future providers may supply reasoning or generation. They do not own:

- Cipher's identity;
- Cipher Core's architecture;
- memory semantics;
- safety policy;
- capability permissions;
- engineering history.

Provider adapters must be replaceable and must not leak provider-specific conventions into the core operating model.

## Failure model

- Identify the failing layer: presentation, core, backend, Skill, Bridge, application, device, provider, or policy.
- Use logs and verified state as evidence.
- Never hide a fallback or silently choose a riskier path.
- Preserve the last known-good state.
- Stop when authority, identity, compatibility, or reliable state is missing.
- Report the exact failed step and the safest next action.
