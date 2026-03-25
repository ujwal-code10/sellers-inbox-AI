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

## Decision Outcomes
1. REPLY
	- Allowed when intent is clear, product context is usable, and confidence is not low.
2. ASK
	- Required when product is unknown, intent is unclear, or confidence is low.

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
