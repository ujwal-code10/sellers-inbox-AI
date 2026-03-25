# Product Context

Source of truth: [MASTER_SPEC.md](../MASTER_SPEC.md).

## What This Product Is
Smart Reply Assistant is a SaaS tool for Nepali Instagram and WhatsApp sellers to generate fast, accurate reply suggestions.

The product is AI-assisted, not AI-autonomous.
Seller always decides what to send.

## Current Platform Status
- Web app is primary (React + Vite).
- Backend is Node.js + Express + PostgreSQL.
- Flutter app is paused and planned for later.

## Core User Goal
Help sellers respond faster to repeated first-inquiry questions (price, availability, delivery, COD) with consistent quality.

## Core Flow
1. Customer sends message on Instagram/WhatsApp.
2. Seller copies message into app.
3. Seller chooses tone and generates reply.
4. AI matches product context and produces suggestion.
5. Seller copies, edits if needed, and sends manually.

## MVP Scope (Current)
- Auth (signup/login/JWT)
- Product management (name, price, keywords, notes)
- Variant management (color-size stock rows)
- Delivery zones and COD settings
- AI reply suggestions with decision engine
- Free/Pro plan limits and eSewa billing

## Constraints
- No product selector in AI flow (auto-match only).
- Romanized Nepali only in reply output; no Devanagari.
- Never use bhai/dai/didi/sir/madam; use Hajur.
- No auto-send and no inbox control in MVP.

## Out of Scope (MVP)
- Auto replying
- Meta API inbox sync
- Offline mode
- Team accounts

## Future Direction
- Resume Flutter after web monetization stabilizes.
- Add templates, analytics, and deeper integrations in later phases.
