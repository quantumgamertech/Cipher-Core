# Agent Framework

## Role model

A Cipher teammate is composed from:

1. Identity and customer-selected name
2. Approved purpose
3. Organization-scoped knowledge
4. Explicit permissions
5. Isolated capability adapters
6. Human approval policies
7. Auditable events and outcomes

## Initial purposes

Personal Operator, Receptionist, Sales / Lead Generation, Scheduler, IT Helpdesk, Customer Support, Research, and Social Media.

## Permission ladder

- **Observe:** display approved information
- **Prepare:** draft or simulate a proposed action
- **Recommend:** explain options and tradeoffs
- **Request:** ask for human approval
- **Execute:** use an explicitly enabled adapter within scope
- **Report:** show evidence of the outcome

Pre-1.0 Cipher stops at prepare/recommend inside local mock state.

## Safety

No capability should inherit access from an unrelated capability. Organization data must remain isolated. High-impact actions require confirmation and cancellation paths. Regulated-domain content must be framed as general information and should direct users to qualified professionals when decisions carry legal, medical, financial, or compliance consequences.
