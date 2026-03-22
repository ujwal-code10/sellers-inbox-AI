# Seller Inbox AI — Progress Tracker

## ✅ Done
- [x] Auth (signup, login, JWT)
- [x] Products + keywords + notes
- [x] Variant grid generator
- [x] Instant stock toggle
- [x] Delivery zones
- [x] AI reply generation (14 rules, Romanized Nepali)
- [x] Smart clarification for ambiguous messages
- [x] Decision engine
- [x] eSewa payment (sandbox)
- [x] Subscriptions + usage_daily tables
- [x] Free/Pro enforcement (checkPlan middleware)
- [x] Upgrade page (monthly/yearly)
- [x] Paywall modal
- [x] Upgrade button in Dashboard
- [x] Landing page (premium dark design)
- [x] Frontend deployed on Vercel
- [x] Backend deployed on Vercel serverless
- [x] Database on Neon PostgreSQL
- [x] MASTER.md v3.1 accurate
- [x] Neon migrations run (keywords, notes, subscriptions, usage_daily)

## 🔄 This Week (In Order)
- [*] Security audit (use prompt in PROMPT.md)
- [*] Fix any HIGH severity issues from audit
- [ ] Connect landing page with real Vercel URLs
- [ ] Message 20 Instagram sellers
- [ ] Get 5 sellers to try the app

## ⏳ Next (After First Sellers)
- [ ] Khalti payment
- [ ] Fix issues sellers report
- [ ] Register eSewa merchant account
- [ ] UI/UX improvements based on feedback

## 🚫 Paused
- Flutter — resume after first paying user
- Tailwind redesign — after real feedback
- WhatsApp/Instagram API — Phase 5
- Google OAuth — not needed yet

## 📋 Decisions Made
- Vercel for both frontend + backend (serverless) — free, working
- Neon PostgreSQL — no Railway needed
- No Railway — Vercel handles everything
- No Google OAuth for MVP
- No Stripe — eSewa + Khalti only
- Flutter paused until web monetized
- No Prisma — raw pg SQL
- Groq not OpenAI
- Variants = individual rows (one color + one size)
- delivery_settings dropped permanently
- payment.ts (no s) is the route file name

## 💰 Revenue Target
- First paying user: this month
- 5 paying users: within 3 weeks
- 30 paying users: within 3 months
- Rs. 299/month × 30 = Rs. 8,970 MRR