MVP Decision Rules

Purpose:
Prevent AI from guessing or replying incorrectly.

Rules:
1. AI must NOT reply if intent is unclear.
2. AI must NOT reply if product cannot be identified.
3. AI must NOT reply if confidence is low.
4. AI may reply only when intent, product, and confidence are clear.
5. When AI cannot reply, it must ask a short clarification question.

Notes:
- Decision logic is handled outside AI prompts.
- AI is responsible only for reply generation, not decision making.
