# Code Comment Standard

Use comments only for logic that is easy to misuse or has non-obvious risk.

## Required format for critical blocks

Use this 4-line template directly above important guardrails:

```ts
// SOURCE: where this data/decision comes from.
// RISK: what can go wrong if this logic is weak.
// PROTECTION: the exact guard/check used here.
// RESULT: what correctness/security outcome this guarantees.
```

## When to use this template

- Payment verification and billing/source-of-truth checks
- Auth/session rotation and CSRF validation paths
- AI deterministic guardrails for trust-critical replies
- Ownership/authorization checks in services/repositories

## When not to comment

- Straightforward assignments or obvious control flow
- Repeating what the code already says clearly
- UI-only styling/layout changes

## Quality rules

- Keep comments short and concrete
- Describe intent and guarantees, not implementation trivia
- Update or remove comments whenever behavior changes
