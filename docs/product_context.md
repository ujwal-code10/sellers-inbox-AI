# Product Context

This is a SaaS app for small Instagram sellers.

Goal:
Help sellers reply faster to customer messages using AI-assisted reply suggestions,
without losing control over tone, language, or context.

This app is NOT a full automation bot.
It is an AI assistant that helps sellers compose replies faster.

---

MVP Scope (Phase 1 – No Meta API dependency):

- AI-assisted reply suggestions (seller must approve or edit)
- Works with pasted or shared customer messages
- Supports mixed language messages (Nepali + English)
- Manual product entry (price, sizes, delivery info)
- One-tap copy of suggested reply
- Android-first Flutter app
- Backend: Node.js + PostgreSQL

MVP does NOT:
- Automatically send replies
- Control the Instagram inbox
- Require Meta API approval
- Replace human judgment

---

Core MVP Flow (Phase 1):

Customer sends message on Instagram →
Seller copies or shares message into app →
AI generates 1–2 suggested replies using product context →
Seller edits or taps copy →
Seller sends reply manually in Instagram

---

Future Scope (Phase 2 – After validation):

- Instagram Graph API integration
- Webhook-based message sync
- In-app inbox
- One-tap send directly to Instagram
- Partial automation with strict safeguards

---

Rules:
- No auto replies without seller approval
- Seller always stays in control
- No WhatsApp in MVP
- No unnecessary features before validation
