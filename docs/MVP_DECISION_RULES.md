# MVP Decision Rules

Source of truth: [MASTER_SPEC.md](../MASTER_SPEC.md), Section 5.5 and Section 8.

## Purpose
Prevent incorrect AI replies by forcing a deterministic gate before generation.

## Core Rule
AI should never guess. If certainty is insufficient, ask clarification.

## Decision Inputs
1. Product Resolution: known vs unknown product context.
2. Intent Detection: PRICE | AVAILABILITY | DELIVERY | COD | GENERAL.
3. Confidence Level: HIGH | MEDIUM | LOW.
4. Candidate Ranking: if product is unknown, return top likely product candidates for one-tap selection.
5. Follow-up Context Flag: when true, apply concise same-conversation follow-up style (especially for availability replies).

## Decision Outcomes
1. REPLY
	- Allowed when intent is clear, product context is usable, and confidence is not low.
2. ASK
	- Required when product is unknown, intent is unclear, or confidence is low.
	- Must include productCandidates when available so seller can tap instead of manual searching.

## Pipeline Order
1. checkReplyLimit middleware
2. Fetch product + variant + delivery zone context
3. resolveProductContext()
4. detectIntent()
5. calculateConfidence()
6. decideReply()
7. If ASK: return clarification question
8. If REPLY: generate final suggestion with system prompt
9. incrementReplyCount() on successful generation

## Guardrails
- Decision logic stays outside prompt instructions.
- Prompt layer only formats/generates text after the decision outcome.
- No auto-send; seller remains in control.

## Low-Friction UX Rules
- Short shorthand inputs such as pp, price pls, last price should classify as PRICE intent.
- ASK responses should prioritize one-tap recovery with likely products first.
- First-message cold-start must still return useful quick picks (stock-ready products) even when recent history is empty.
- If recent product hints are available, include them in candidate ranking but never bypass safety rules.
- In follow-up context, availability replies should stay focused on asked attributes (size-only -> size answer, color-only -> color answer).
