# Smart Reply Assistant — Master Project Specification
> **Version:** 3.1 — Live codebase blueprint  
> **Last Updated:** March 2026  
> **Status:** Web MVP built. Backend deployment in progress. Flutter paused.  
> **Rule:** Every technical decision must reference this document. Update when anything changes.

---

## 📋 Document Metadata

| Field | Value |
|---|---|
| **App Name** | Smart Reply Assistant (Seller Inbox AI) |
| **Tagline** | AI-powered reply generation for Nepali Instagram and WhatsApp sellers |
| **Primary Language** | TypeScript (backend + web), Dart (mobile — paused) |
| **Target Platforms** | Web (React) — primary. Flutter (iOS + Android) — future. |
| **AI Provider** | Groq (llama-3.3-70b-versatile) |
| **Database** | PostgreSQL 15 in Docker (local), Neon PostgreSQL (production) |
| **Backend Port** | 4000 (local) |
| **Web Port** | 3000 (local, Vite dev server) |

### Tech Stack — Exact Versions

| Layer | Technology | Notes |
|---|---|---|
| **Web Frontend** | React 18 + Vite + TypeScript | No Next.js. Plain React SPA. |
| **Styling** | CSS (custom classes) | No Tailwind yet. Future: add Tailwind. |
| **Mobile** | Flutter 3 + Dart | PAUSED. Resume after web monetized. |
| **Backend** | Node.js 20 + Express 4 + TypeScript | ESM modules |
| **Database** | PostgreSQL 15 | Docker locally, Neon PostgreSQL in production |
| **ORM** | Raw SQL via `pg` (node-postgres) | No Prisma. Pool in `src/utils/db.ts` |
| **Auth** | Custom JWT — `jsonwebtoken` + `bcryptjs` | 7-day tokens |
| **AI** | Groq SDK — `groq-sdk` package | Model: `llama-3.3-70b-versatile` |
| **Frontend Hosting** | Vercel | Auto-deploy from GitHub |
| **Backend Hosting** | Vercel serverless | Included in free tier |
| **DB Hosting** | Neon PostgreSQL | Managed, serverless PostgreSQL |

### Environment Variables

| Variable | Used In | Notes |
|---|---|---|
| `DATABASE_URL` | Backend (Vercel serverless) | Neon PostgreSQL connection string |
| `JWT_SECRET` | Backend (Vercel serverless) | Token signing secret |
| `GROQ_API_KEY` | Backend (Vercel serverless) | Groq AI API key |
| `ESEWA_MERCHANT_CODE` | Backend (Vercel serverless) | `EPAYTEST` sandbox / real code production |
| `ESEWA_SECRET_KEY` | Backend (Vercel serverless) | eSewa HMAC signing secret |
| `FRONTEND_URL` | Backend (Vercel serverless) | Vercel frontend URL for eSewa redirect |
| `NODE_ENV` | Backend (Vercel serverless) | `production` |

### Environment Strategy

```
Local:      Docker PostgreSQL + Vite dev server
Production: Vercel (frontend) + Vercel serverless (backend) + Neon (database)
```

| Environment | Backend | Frontend | DB |
|---|---|---|---|
| **Local** | `http://localhost:4000` | `http://localhost:3000` | Docker PostgreSQL |
| **Production** | Vercel serverless URL | Vercel URL | Neon PostgreSQL |

---

## 1. Product Vision

### 1.1 Purpose
Smart Reply Assistant helps small Nepali Instagram and WhatsApp sellers generate fast, accurate, consistent AI-powered replies to customer messages — without typing every response manually.

### 1.2 Problem Being Solved
- Typing the same replies repeatedly (price, availability, delivery) for every customer
- Giving inconsistent replies across different times of day
- Missing sales because responses are too slow

### 1.3 The Core Flow
```
1. Customer sends message on WhatsApp/Instagram
2. Seller copies the message
3. Seller opens Smart Reply Assistant
4. Seller pastes message into one text field
5. Seller selects tone (Friendly / Professional / Persuasive)
6. Seller taps Generate
7. AI matches product, generates reply
8. Seller copies reply → pastes back into WhatsApp/Instagram
```

**NO product selector.** AI auto-matches. If unclear → asks for clarification, never guesses.

**NOT for every message.** Best for first customer inquiries. Follow-up messages are faster to type manually.

### 1.4 Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Solo Seller** | Individual selling via WhatsApp/Instagram | Reply to 50+ daily messages quickly |
| **Small Business Owner** | 2–5 staff | Consistent branded replies |
| **Reseller** | Dropshipper with multiple product lines | Fast replies per product |

### 1.5 Language — CRITICAL

**Romanized Nepali only** — never Devanagari script.

| Customer types | Example |
|---|---|
| Romanized Nepali | `"yo hoodie available cha? kati ho price?"` |
| English | `"Is this available? What is the price?"` |
| Mixed | `"nice product! kati ko ho?"` |

**NEVER output:** "छ", "हुडी" or any Devanagari.
**NEVER use:** bhai, dai, didi, sir, madam. Always use "Hajur".

### 1.6 Success Metrics (KPIs)

| Metric | 3-Month Target | 12-Month Target |
|---|---|---|
| Registered sellers | 500 | 10,000 |
| Monthly Active Users | 200 | 5,000 |
| Paying subscribers | 30 | 800 |
| Replies generated/day | 1,000 | 50,000 |
| MRR | Rs. 6,000 | Rs. 160,000 |

---

## 2. Product Scope

### 2.1 Currently Built (Working)
- [x] Auth (signup, login, JWT)
- [x] Products (name, price, keywords, notes)
- [x] Variant grid generator (colors × sizes → individual rows)
- [x] Instant variant stock toggle (optimistic update)
- [x] Bulk variant actions (mark all in/out of stock)
- [x] Delivery zone management (per-zone pricing + COD)
- [x] AI reply generation (paste → generate → copy)
- [x] Tone selector (Friendly, Professional, Persuasive)
- [x] Auto product matching (name + keywords)
- [x] Smart clarification for ambiguous messages
- [x] Decision engine (productResolver + confidence + decisionEngine)
- [x] Stock status badge
- [x] eSewa payment (initiate + verify)
- [x] subscriptions + usage_daily tables
- [x] Free/Pro enforcement (checkPlan middleware)
- [x] Upgrade page (monthly/yearly toggle)
- [x] Paywall modal
- [x] Upgrade button in Dashboard nav
- [x] Payment success/failure pages
- [x] Landing page (premium dark HTML)

### 2.2 Not Built Yet
- [*] vercel backend deployed
- [*] Khalti payment
- [*] Landing page live with real URLs
- [ ] Real seller testing

### 2.3 Future (After Monetization)
- [ ] Flutter mobile app
- [ ] Reply templates
- [ ] Usage stats dashboard
- [ ] WhatsApp/Instagram API integration
- [ ] Team accounts

### 2.4 Out of Scope (MVP)
- Auto-sending messages
- Devanagari script
- Offline mode

---

## 3. User Roles & Plans

### 3.1 Free vs Pro (ENFORCED)

| Feature | Free | Pro |
|---|---|---|
| AI replies per day | 20 | Unlimited |
| Products | 5 | Unlimited |
| Variants | Unlimited | Unlimited |
| Delivery zones | Unlimited | Unlimited |

### 3.2 Pricing

| Plan | Price | Notes |
|---|---|---|
| Free | Rs. 0/month | 20 replies/day, 5 products |
| Pro Monthly | Rs. 299/month | Unlimited |
| Pro Yearly | Rs. 2,499/year | Save 30% |

### 3.3 Payment Methods

| Provider | Status | Notes |
|---|---|---|
| eSewa | ✅ Built (sandbox) | Most used wallet in Nepal |
| Khalti | ⏳ Pending | Second most used |
| Stripe | ❌ Skip | No international cards in target market |

---

## 4. Expected Usage & Scale

### 4.1 User Growth

| Timeframe | Registered | Active | Paid |
|---|---|---|---|
| Month 1 | 50 | 30 | 5 |
| Month 3 | 500 | 200 | 30 |
| Month 6 | 2,000 | 1,000 | 120 |
| Month 12 | 10,000 | 5,000 | 800 |

### 4.2 AI Cost (Groq)

| Scale | Daily Requests | Cost |
|---|---|---|
| MVP (200 MAU) | 1,000 | ~$0.50/day |
| Growth (1,000 MAU) | 5,000 | ~$2.50/day |
| Scale (5,000 MAU) | 25,000 | ~$12/day |

---

## 5. System Architecture

### 5.1 Architecture

```
┌─────────────────────────────────┐
│  Vercel (Frontend)              │
│  React Web App                  │
│  Landing Page (static)          │
└──────────────┬──────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────┐
│  Vercel serverless (Backend)    │
│  Node.js + Express              │
│  Port 4000 (local)              │
│                                 │
│  /api/auth                      │
│  /api/products                  │
│  /api/variants                  │
│  /api/delivery-zones            │
│  /api/ai                        │
│  /api/payments                  │
└──────────┬──────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
Neon PostgreSQL  Groq API
(SSL required)  (llama-3.3-70b)
```

### 5.2 Backend File Structure

```
backend/
├── src/
│   ├── ai/
│   │   └── systemprompt.ts
│   ├── decision/
│   │   ├── confidence.ts
│   │   └── decisionEngine.ts
│   ├── handlers/
│   │   └── messageHandler.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── checkPlan.ts
│   ├── migrations/
│   │   ├── create_delivery_zones.sql
│   │   ├── add_keywords_notes_to_products.sql
│   │   ├── add_subscriptions_usage.sql
│   │   └── drop_delivery_settings.sql
│   ├── product/
│   │   └── productResolver.ts
│   ├── routes/
│   │   ├── ai.ts
│   │   ├── auth.ts
│   │   ├── delivery.ts
│   │   ├── payment.ts        ← NOTE: no 's' at end
│   │   ├── products.ts
│   │   └── variants.ts
│   ├── utils/
│   │   └── db.ts
│   ├── app.ts
│   └── server.ts
```

### 5.3 Web Frontend File Structure

```
web/
├── public/
│   └── landing.html
├── src/
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Products.tsx
│   │   ├── DeliveryZones.tsx
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Upgrade.tsx
│   │   └── PaymentSuccess.tsx
│   ├── services/
│   │   └── api.ts
│   ├── App.tsx
│   └── main.tsx
```

### 5.4 Plan Enforcement (checkPlan.ts)

```
checkReplyLimit:
  → If Pro + active + not expired → allow
  → If Free → check usage_daily today
  → count >= 20 → 429 { error, upgrade: true }

checkProductLimit:
  → If Free and products >= 5 → 403 { error, upgrade: true }

incrementReplyCount:
  → Called after successful reply
  → Upserts usage_daily
```

### 5.5 AI Reply Pipeline

```
POST /api/ai/suggest-reply
  Request body: { customerMessage, tone?, forcedProduct? }

  1. checkReplyLimit middleware
  2. Fetch products + variants + delivery zones
  3. Optional forcedProduct parameter:
     - If forcedProduct provided in request body
     - Skip resolveProductContext()
     - Use forcedProduct as matchedProduct directly
     - Set productKnown: true
     - Proceed directly to Groq reply generation
  4. Normal flow (if no forcedProduct):
     - resolveProductContext() → productKnown + matchedProduct
     - detectIntent() → PRICE|AVAILABILITY|DELIVERY|COD|GENERAL
     - calculateConfidence() → HIGH|MEDIUM|LOW
     - decideReply() → REPLY | ASK
  5a. ASK → Groq clarification (context-aware) + product picker UI
  5b. REPLY → Groq with SYSTEM_PROMPT + product context (temp: 0.3)
  6. incrementReplyCount()
```

---

## 6. Database Design

### 6.1 Tables

#### `users`
```sql
id SERIAL PRIMARY KEY
name TEXT NOT NULL
email TEXT UNIQUE NOT NULL
password TEXT NOT NULL  -- bcrypt 10 rounds
created_at TIMESTAMP DEFAULT now()
```

#### `products`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
name TEXT NOT NULL
price INTEGER NOT NULL  -- Rs., no decimals
keywords TEXT           -- comma-separated alternate names
notes TEXT              -- quality, fabric, wash care
created_at TIMESTAMP DEFAULT now()
```

#### `variants`
```sql
id SERIAL PRIMARY KEY
product_id INTEGER REFERENCES products(id) ON DELETE CASCADE
color TEXT NOT NULL  -- ONE color only, never comma-separated
size TEXT NOT NULL   -- ONE size only, never comma-separated
available BOOLEAN DEFAULT true
created_at TIMESTAMP DEFAULT now()
```

> **CRITICAL:** One row = one color + one size. Never `"Red,Blue"` in one row.

#### `delivery_zones`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
name VARCHAR(255) NOT NULL
price NUMERIC(10,2) NOT NULL
cod_available BOOLEAN DEFAULT true
created_at TIMESTAMP DEFAULT now()
```

#### `subscriptions`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE
plan VARCHAR(20) NOT NULL DEFAULT 'free'
billing VARCHAR(20) NOT NULL DEFAULT 'monthly'
status VARCHAR(20) NOT NULL DEFAULT 'active'
started_at TIMESTAMP DEFAULT now()
expires_at TIMESTAMP
payment_ref VARCHAR(255)
created_at TIMESTAMP DEFAULT now()
```

#### `usage_daily`
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
date DATE NOT NULL DEFAULT CURRENT_DATE
reply_count INTEGER NOT NULL DEFAULT 0
UNIQUE(user_id, date)
```

### 6.2 Relationships
```
users → products (1:N)
users → delivery_zones (1:N)
users → subscriptions (1:1)
users → usage_daily (1:N)
products → variants (1:N)
```

### 6.3 Removed Tables
- `delivery_settings` — dropped permanently. Only `delivery_zones` exists.

### 6.4 Indexes
```sql
CREATE INDEX idx_delivery_zones_user_id ON delivery_zones(user_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_usage_daily_user_date ON usage_daily(user_id, date);
```

---

## 7. API Design

### 7.1 Conventions

| Convention | Value |
|---|---|
| Base URL (local) | `http://localhost:4000/api` |
| Base URL (production) | `https://your-backend.railway.app/api` |
| Auth header | `Authorization: Bearer <token>` |
| Token expiry | 7 days |
| Error format | `{ "error": "message" }` |
| Paywall error | `{ "error": "...", "upgrade": true }` |

### 7.2 Auth (`/api/auth`)
| POST | `/auth/signup` | `{ name, email, password }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | → `{ user }` |

### 7.3 Products (`/api/products`)
| GET | `/products` | list all |
| POST | `/products` | create — checkProductLimit applied |
| PATCH | `/products/:id` | update — ownership enforced |
| DELETE | `/products/:id` | delete + cascade variants |

### 7.4 Variants (`/api`)
| GET | `/products/:id/variants` | ownership verified |
| POST | `/products/:id/variants` | `{ color, size, available? }` |
| PATCH | `/variants/:id` | `{ available: boolean }` — ownership via JOIN |

### 7.5 Delivery Zones (`/api`)
| GET/POST/PATCH/DELETE | `/delivery-zones` | full CRUD, ownership enforced |

### 7.6 AI (`/api/ai`)
| POST | `/ai/suggest-reply` | `{ customerMessage, tone? }` — checkReplyLimit applied |

### 7.7 Payments (`/api/payments`)
| GET | `/payments/plans` | current plan + usage + pricing |
| POST | `/payments/esewa/initiate` | `{ billing: 'monthly'|'yearly' }` |
| POST | `/payments/esewa/verify` | `{ encodedData, billing }` |

---

## 8. AI System

### 8.1 System Prompt
`backend/src/ai/systemprompt.ts`

### 8.2 Product Matching
1. Check message for product name (partial match)
2. Check message against product keywords
3. Match → `productKnown: true`
4. No match → `productKnown: false` → ASK

### 8.3 The 14 Reply Rules

| Rule | Trigger | Style |
|---|---|---|
| 1 | Price only | Price only, no emoji |
| 2 | Specific variant available | "Cha hajur 😊" + variant + price |
| 3 | Variant unavailable, others exist | State unavailable + list available |
| 4 | General availability | "Cha hajur 😊" or sold out |
| 5 | Delivery asked | All zones with exact prices |
| 6 | COD asked | Available or not |
| 7 | Greeting only | "Hajur 😊" only |
| 8 | Combo question | All parts, 3 sentences max |
| 9 | Discount/bargain | "Price fixed cha" |
| 10 | Quantity/bulk | Fallback to seller |
| 11 | How to order | Fallback to seller |
| 12 | Quality/fabric | Notes if available, else fallback |
| 13 | Return/exchange | Redirect to seller |
| 14 | Off-topic | "Seller lai directly message garnu hola" |

### 8.4 Config
```
model: llama-3.3-70b-versatile
temperature: 0.3
```

### 8.5 Language Rules
- "Cha hajur 😊" → availability confirm ONLY
- "Hajur 😊" → greeting ONLY
- NEVER bhai/dai/didi/sir/madam
- NEVER Devanagari

---

## 9. Monetization

### 9.1 eSewa (Built ✅)
- epay v2 API, HMAC-SHA256
- Sandbox: `https://rc-epay.esewa.com.np/api/epay/main/v2/form`
- Production: `https://epay.esewa.com.np/api/epay/main/v2/form`
- Success → `/payment/success?data=[base64]` → verify → upsert subscriptions

### 9.2 Enforcement (Built ✅)
- `checkReplyLimit` on `/ai/suggest-reply`
- `checkProductLimit` on POST `/products`
- `incrementReplyCount()` after successful reply
- Pro check: plan + status + expires_at in subscriptions

---

## 10. Security

### 10.1 Implemented
- bcrypt 10 rounds
- JWT HS256, 7-day
- Ownership checks on all data routes
- eSewa HMAC verification
- Server-side plan enforcement

### 10.2 Still Needed (Phase 3)
- Rate limiting on /auth/login
- Zod input validation
- CORS restricted (currently `*`)
- Helmet.js
- 2,000 char limit on customerMessage
- Duplicate payment prevention

---

## 11. Roadmap

### Phase 1 — Web MVP ✅
### Phase 2 — Monetization ✅ (built, deploying)
Remaining: Railway deploy, eSewa production test, Khalti

### Phase 3 — Polish
Khalti, Tailwind, reply templates, Sentry, PostHog, rate limiting

### Phase 4 — Mobile
Flutter login, feature parity, Share Sheet, app stores

### Phase 5 — Automation
WhatsApp API, Instagram API, auto-reply, team accounts

---

## 12. DevOps

### 12.1 Local
```bash
docker-compose up -d       # PostgreSQL
cd backend && npm run dev  # :4000
cd web && npm run dev      # :3000
```

### 12.2 Production

| Service | Platform | Status |
|---|---|---|
| Frontend | Vercel | ✅ Deployed |
| Backend | Vercel serverless | ✅ Working |
| Database | Neon PostgreSQL | ✅ Live |

### 12.3 Vercel Backend Setup
- Entry point: api/[...path].js at project root
- Imports: backend/dist/app.js after build
- Build: cd backend && npm run build (via vercel.json)
- Routes: all /api/* requests handled by serverless function

### 12.4 Vercel Frontend Setup
```
Root directory:   web
Build command:    npm run build
Output:           dist
```

### 12.5 package.json Scripts
```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js"
}
```

---

## 13. Monitoring

### 13.1 Current
- `console.error()` in all routes
- `/api/debug` — env + DB status
- `/health` — `{ status: "ok" }`
- Railway logs dashboard

### 13.2 Fix Workflow
```
Railway logs → copy error → Claude + MASTER.md → fix → push
```

### 13.3 Planned (Phase 3)
Sentry, Winston, PostHog

---

## 14. Scaling

| Users (MAU) | Strategy |
|---|---|
| 0–1,000 | Vercel free tier + Neon free |
| 1,000–10,000 | Upgrade Neon + Redis rate limiting |
| 10,000–50,000 | Read replica |
| 50,000+ | Kubernetes, sharding |

---

## 15. Known Issues

| Issue | Severity | Fix When |
|---|---|---|
| Flutter hardcoded JWT + IP | 🔴 High | When resuming Flutter |
| No rate limiting on /auth/login | 🟡 Medium | Phase 3 |
| No input validation (Zod) | 🟡 Medium | Phase 3 |
| CORS allows all origins | 🟡 Medium | Before launch |
| No customerMessage max length | 🟡 Medium | Phase 3 |
| No duplicate payment prevention | 🟡 Medium | Before eSewa goes live |
| eSewa sandbox only | 🟡 Medium | After Railway deployment |
| Khalti not built | 🟡 Medium | Phase 3 |
| No Sentry | 🟡 Medium | Phase 3 |

---

## 16. How to Use with AI

```
"Read this MASTER.md as source of truth before writing any code.
[PASTE MASTER.md]

Rules:
- Tech stack from Document Metadata
- DB schema from Section 6 exactly
- API from Section 7
- Groq NOT OpenAI
- Raw pg NOT Prisma
- ESM imports with .js extensions
- No new tables not in Section 6
- Errors: { error: 'message' }
- Paywall: { error: '...', upgrade: true }"
```

### Critical Facts — Never Forget
1. **No Prisma** — raw `pg` Pool
2. **Groq not OpenAI** — `groq-sdk`, `llama-3.3-70b-versatile`
3. **ESM imports** — `.js` extensions required
4. **No product selector** — AI auto-matches
5. **Romanized Nepali only** — never Devanagari
6. **Never bhai/dai/didi** — always "Hajur"
7. **Variants = individual rows** — one color + one size only
8. **delivery_settings GONE** — only `delivery_zones`
9. **JWT 7-day** — localStorage (web)
10. **Neon needs SSL** — `ssl: { rejectUnauthorized: false }`
11. **Payment built** — subscriptions + usage_daily + checkPlan
12. **Paywall** — `{ error: "Daily limit reached", upgrade: true }`
13. **Frontend = Vercel, Backend = Vercel serverless, DB = Neon** — never mix these up
14. **Route file is `payment.ts`** — no 's' at the end