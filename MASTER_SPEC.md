# Smart Reply Assistant — Master Project Specification
> **Version:** 3.0 — Live codebase blueprint  
> **Last Updated:** March 2026  
> **Status:** Web MVP built. Backend deployment in progress. Flutter paused until web is monetized.  
> **Rule:** Every technical decision must reference this document. Update this document when anything changes. Never let code drift from this spec.

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
| **Backend** | Node.js 20 + Express 4 + TypeScript | ESM modules (`"type": "module"`) |
| **Database** | PostgreSQL 15 | Docker locally, Neon PostgreSQL in production |
| **ORM** | Raw SQL via `pg` (node-postgres) | No Prisma. Pool in `src/utils/db.ts` |
| **Auth** | Custom JWT — `jsonwebtoken` + `bcryptjs` | 7-day tokens |
| **AI** | Groq SDK — `groq-sdk` package | Model: `llama-3.3-70b-versatile` |
| **Web Hosting** | Vercel (frontend + backend serverless) | |
| **DB Hosting** | Neon PostgreSQL | Managed, serverless PostgreSQL |
| **CI/CD** | GitHub → Vercel auto-deploy | Push to main = auto deploy |

### Environment Variables

| Variable | Used In | Notes |
|---|---|---|
| `DATABASE_URL` | Backend | Neon PostgreSQL connection string |
| `JWT_SECRET` | Backend | Token signing secret — long random string |
| `GROQ_API_KEY` | Backend | Groq AI API key |
| `ESEWA_MERCHANT_CODE` | Backend | `EPAYTEST` (sandbox) / real code (production) |
| `ESEWA_SECRET_KEY` | Backend | eSewa HMAC signing secret |
| `FRONTEND_URL` | Backend | Vercel frontend URL — used in eSewa redirect |
| `NODE_ENV` | Backend | `development` or `production` |
| `VERCEL` | Backend | Auto-set by Vercel in production |

### Environment Strategy

```
Local (Docker PostgreSQL + Vite) → Production (Vercel serverless + Neon)
```

| Environment | Backend URL | Frontend URL | DB |
|---|---|---|---|
| **Local** | `http://localhost:4000` | `http://localhost:3000` | Docker PostgreSQL |
| **Production** | Vercel serverless (`/api/*`) | Vercel URL | Neon PostgreSQL |

---

## 1. Product Vision

### 1.1 Purpose
Smart Reply Assistant helps small Nepali Instagram and WhatsApp sellers generate fast, accurate, consistent AI-powered replies to customer messages — without typing every response manually.

### 1.2 Problem Being Solved
Small sellers managing sales through WhatsApp and Instagram spend significant time:
- Typing the same replies repeatedly (price, availability, delivery) for every customer
- Giving inconsistent replies across different times of day
- Missing sales because responses are too slow

### 1.3 The Core Flow (What Sellers Actually Do)
```
1. Customer sends a message on WhatsApp/Instagram
2. Seller copies the message
3. Seller opens Smart Reply Assistant
4. Seller pastes the message into one text field
5. Seller selects tone (Friendly / Professional / Persuasive)
6. Seller taps Generate
7. AI reads the message, matches it to the correct product
   from the seller's catalogue, generates the reply
8. Seller copies the reply → pastes back into WhatsApp/Instagram
```

**There is NO product selector step.** The AI automatically identifies which product the customer is asking about from the message text. If it cannot identify a product, it asks for clarification — it never guesses.

**NOT for every message.** Best used for first customer inquiries — price, availability, delivery questions. Follow-up messages mid-conversation are faster to type manually.

### 1.4 Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Solo Seller** | Individual selling via WhatsApp/Instagram, 20–45, mobile-first | Reply to 50+ daily messages quickly |
| **Small Business Owner** | 2–5 staff, WhatsApp + Instagram | Consistent branded replies |
| **Reseller** | Dropshipper with multiple product lines | Fast replies matching each product |

### 1.5 Language — CRITICAL
Target users type in **Romanized Nepali** — Nepali words written in Latin/English letters. This is NOT Devanagari script.

| Customer types | Example |
|---|---|
| Romanized Nepali | `"yo hoodie available cha? kati ho price?"` |
| English | `"Is this available? What is the price?"` |
| Mixed | `"nice product! kati ko ho?"` |

**The AI must NEVER output Devanagari script (not "छ", not "हुडी").** Always reply in the same script style as the customer.

**The AI must NEVER use:** bhai, dai, didi, sir, madam — under any circumstance. Always use "Hajur" as the neutral address.

### 1.6 Value Proposition
**Smart Reply Assistant** helps **small Nepali sellers** respond to customer messages **5× faster** without spending time writing repetitive replies manually.

### 1.7 Success Metrics (KPIs)

| Metric | 3-Month Target | 12-Month Target |
|---|---|---|
| Registered sellers | 500 | 10,000 |
| Monthly Active Users | 200 | 5,000 |
| Paying subscribers | 30 | 800 |
| Replies generated/day | 1,000 | 50,000 |
| MRR | Rs. 6,000 | Rs. 160,000 |

---

## 2. Product Scope

### 2.1 Currently Built (Web — Working)
- [x] User registration and login (email + password)
- [x] JWT authentication (7-day tokens)
- [x] Product management (add, delete, list)
- [x] Product fields: name, price, keywords, notes
- [x] Variant grid generator (type colors + sizes → auto-generate combinations)
- [x] Instant variant stock toggle (no confirmation modal, optimistic update)
- [x] Bulk variant actions (mark all in stock / sold out)
- [x] Delivery zone management (add, edit, delete zones with per-zone pricing + COD)
- [x] AI reply generation (paste message → generate → copy)
- [x] Tone selector (Friendly, Professional, Persuasive)
- [x] Auto product matching from customer message (name + keywords)
- [x] Smart clarification for ambiguous messages ("yo cha?" → asks which product)
- [x] Decision engine (productResolver + confidence + decisionEngine)
- [x] Stock status badge on product list (All in stock / X/Y in stock / Sold out)
- [x] eSewa payment integration (initiate + verify)
- [x] Subscriptions table + usage_daily table
- [x] Free vs Pro plan enforcement (checkPlan middleware)
- [x] Daily reply limit (20/day free)
- [x] Product limit (5 free)
- [x] Upgrade page (Free vs Pro pricing with monthly/yearly toggle)
- [x] Paywall modal (triggers when limit hit)
- [x] Upgrade button in Dashboard nav
- [x] Payment success/failure pages
- [x] Landing page (HTML — premium dark design)

### 2.2 Not Built Yet — Next Priority
- [ ] Backend deployed to Vercel serverless (in progress)
- [ ] Khalti payment integration
- [ ] Landing page connected to live app
- [ ] Real seller testing

### 2.3 Future Features (After Monetization)
- [ ] Flutter mobile app (resume after web has paying users)
- [ ] Reply templates (save and reuse replies)
- [ ] Reply rating system (thumbs up/down)
- [ ] Usage stats dashboard
- [ ] WhatsApp Business API integration
- [ ] Instagram DM integration
- [ ] Team accounts

### 2.4 Permanently Out of Scope (MVP)
- Automated message sending (copy-paste only, seller always sends manually)
- Native WhatsApp/Instagram OAuth
- Devanagari script support (Romanized Nepali only)
- Offline mode

---

## 3. User Roles & Permissions

| Role | How Assigned | Permissions |
|---|---|---|
| **Seller** | On registration | Own products, variants, delivery zones, generate replies |
| **Admin** | Manual DB flag | Future — monitor usage, manage users |

### 3.1 Free vs Pro Limits (ENFORCED ✅)

| Feature | Free | Pro |
|---|---|---|
| AI replies per day | 20 | Unlimited |
| Products | 5 | Unlimited |
| Variants per product | Unlimited | Unlimited |
| Delivery zones | Unlimited | Unlimited |

### 3.2 Pricing Plans

| Plan | Price | Notes |
|---|---|---|
| Free | Rs. 0/month | 20 replies/day, 5 products max |
| Pro Monthly | Rs. 299/month | Unlimited everything |
| Pro Yearly | Rs. 2,499/year | Save 30% — 2 months free |

### 3.3 Payment Methods

| Provider | Status | Notes |
|---|---|---|
| eSewa | ✅ Built | Sandbox credentials in .env |
| Khalti | ⏳ Pending | Build after eSewa tested in production |
| Stripe | ❌ Not planned | Most Nepali sellers have no international card |

---

## 4. Expected Usage & Scale

### 4.1 User Growth Estimates

| Timeframe | Registered | Monthly Active | Paid |
|---|---|---|---|
| Month 1 | 50 | 30 | 5 |
| Month 3 | 500 | 200 | 30 |
| Month 6 | 2,000 | 1,000 | 120 |
| Month 12 | 10,000 | 5,000 | 800 |
| Year 3 | 80,000 | 30,000 | 6,000 |

### 4.2 Daily Actions (at 1,000 MAU)

| Action | Daily Count | Peak (3×) |
|---|---|---|
| AI reply generations | 5,000 | 15,000 |
| User logins | 600 | 1,800 |
| Variant stock toggles | 300 | 900 |
| Product add/update | 200 | 600 |

### 4.3 AI Cost Estimates (Groq)

| Scale | Daily Requests | Estimated Cost |
|---|---|---|
| MVP (200 MAU) | 1,000 | ~$0.50/day |
| Growth (1,000 MAU) | 5,000 | ~$2.50/day |
| Scale (5,000 MAU) | 25,000 | ~$12/day |

> Groq is significantly cheaper than OpenAI. Free plan cap (20/day) limits cost exposure.

### 4.4 SLA Targets

| Metric | Target |
|---|---|
| API response time (p95, non-AI) | < 300ms |
| AI reply generation time (p95) | < 5 seconds |
| Uptime | 99.5% |

---

## 5. System Architecture

### 5.1 Current Architecture

```
┌─────────────────────────────────────┐
│         Clients                     │
│  React Web App (Vercel)             │
│  Landing Page (Vercel static)       │
│  Flutter Mobile (PAUSED)            │
└──────────────┬──────────────────────┘
               │ HTTPS / REST
               ▼
┌─────────────────────────────────────┐
│     Node.js + Express API           │
│     Vercel Serverless Functions     │
│     backend/api/[...path].ts        │
│     Port 4000 (local)               │
│                                     │
│  /api/auth      — Auth routes       │
│  /api/products  — Product CRUD      │
│  /api/variants  — Variant CRUD      │
│  /api/delivery-zones — Delivery     │
│  /api/ai        — Reply generation  │
│  /api/payments  — eSewa/Khalti      │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
Neon PostgreSQL  Groq API
(pg pool +      (llama-3.3-70b)
 SSL required)
```

### 5.2 Backend File Structure (Actual)

```
backend/
├── api/
│   └── [...path].ts               # Vercel serverless entry point
├── src/
│   ├── ai/
│   │   └── systemprompt.ts        # System prompt + tone injection
│   ├── decision/
│   │   ├── confidence.ts          # Confidence scoring
│   │   └── decisionEngine.ts      # REPLY / ASK / SKIP logic
│   ├── handlers/
│   │   └── messageHandler.ts      # Message orchestration
│   ├── middleware/
│   │   ├── auth.ts                # JWT verification → req.userId
│   │   └── checkPlan.ts           # Plan enforcement + usage counter
│   ├── migrations/
│   │   ├── create_delivery_zones.sql
│   │   ├── add_keywords_notes_to_products.sql
│   │   ├── add_subscriptions_usage.sql
│   │   └── drop_delivery_settings.sql
│   ├── product/
│   │   └── productResolver.ts     # Product matching (name + keywords)
│   ├── routes/
│   │   ├── ai.ts                  # POST /api/ai/suggest-reply
│   │   ├── auth.ts                # POST /api/auth/signup|login GET /me
│   │   ├── delivery.ts            # CRUD /api/delivery-zones
│   │   ├── payments.ts            # eSewa initiate + verify + plans
│   │   ├── products.ts            # CRUD /api/products
│   │   └── variants.ts            # CRUD /api/variants + availability
│   ├── utils/
│   │   └── db.ts                  # pg Pool singleton (SSL for Neon)
│   ├── app.ts                     # Express app setup
│   └── server.ts                  # HTTP server entry point
```

### 5.3 Web Frontend File Structure (Actual)

```
web/
├── public/
│   └── landing.html               # Landing page (static)
├── src/
│   ├── context/
│   │   └── AuthContext.tsx        # Auth state + token management
│   ├── pages/
│   │   ├── Dashboard.tsx          # Main AI reply screen + tabs
│   │   ├── Products.tsx           # Product + variant management
│   │   ├── DeliveryZones.tsx      # Delivery zone management
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Upgrade.tsx            # Free vs Pro pricing page
│   │   └── PaymentSuccess.tsx     # eSewa redirect landing
│   ├── services/
│   │   └── api.ts                 # ApiClient class — all HTTP calls
│   ├── App.tsx                    # Router (includes /upgrade, /payment/*)
│   └── main.tsx                   # Entry point
```

### 5.4 checkPlan.ts — Plan Enforcement

```
checkReplyLimit middleware:
  → GET subscription for user
  → If Pro + active + not expired → allow
  → If Free → check usage_daily for today
  → If count >= 20 → return 429 { error, upgrade: true }
  → Else → allow

checkProductLimit middleware:
  → Same subscription check
  → Count products for user
  → If Free and count >= 5 → return 403 { error, upgrade: true }

incrementReplyCount function:
  → Called after successful AI reply generation
  → INSERT or UPDATE usage_daily for today
```

### 5.5 AI Reply Pipeline (Exact Flow)

```
POST /api/ai/suggest-reply
  │
  ├─ 1. checkReplyLimit middleware
  │      → 429 if free user at daily limit
  │
  ├─ 2. Fetch seller's products + variants + delivery zones from DB
  │
  ├─ 3. resolveProductContext()
  │      Match customer message against product names + keywords
  │
  ├─ 4. detectIntent()
  │      → PRICE|AVAILABILITY|DELIVERY|COD|GENERAL|UNKNOWN
  │
  ├─ 5. calculateConfidence()
  │      → HIGH|MEDIUM|LOW
  │
  ├─ 6. decideReply()
  │      → action: REPLY | ASK
  │
  ├─ 7a. If ASK → Groq clarification prompt
  │
  ├─ 7b. If REPLY → Groq with SYSTEM_PROMPT + product context
  │           temperature: 0.3
  │
  └─ 8. incrementReplyCount(userId)
```

---

## 6. Database Design

### 6.1 Tables (Actual Schema)

#### `users`
```sql
id          SERIAL PRIMARY KEY
name        TEXT NOT NULL
email       TEXT UNIQUE NOT NULL
password    TEXT NOT NULL          -- bcrypt hash, 10 rounds
created_at  TIMESTAMP DEFAULT now()
```

#### `products`
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE
name        TEXT NOT NULL
price       INTEGER NOT NULL       -- in Rs., no decimals
keywords    TEXT                   -- comma-separated alternate names
notes       TEXT                   -- quality, fabric, wash care info
created_at  TIMESTAMP DEFAULT now()
```

#### `variants`
```sql
id          SERIAL PRIMARY KEY
product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE
color       TEXT NOT NULL          -- single color (NOT comma-separated)
size        TEXT NOT NULL          -- single size (NOT comma-separated)
available   BOOLEAN DEFAULT true
created_at  TIMESTAMP DEFAULT now()
```

> **CRITICAL:** Each variant is ONE color + ONE size combination.
> NEVER store `{ color: "Red,Blue", size: "S,M,L" }` — that was the old bad pattern.

#### `delivery_zones`
```sql
id            SERIAL PRIMARY KEY
user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE
name          VARCHAR(255) NOT NULL
price         NUMERIC(10,2) NOT NULL
cod_available BOOLEAN DEFAULT true
created_at    TIMESTAMP DEFAULT now()
```

#### `subscriptions`
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE
plan        VARCHAR(20) NOT NULL DEFAULT 'free'
billing     VARCHAR(20) NOT NULL DEFAULT 'monthly'
status      VARCHAR(20) NOT NULL DEFAULT 'active'
started_at  TIMESTAMP DEFAULT now()
expires_at  TIMESTAMP
payment_ref VARCHAR(255)
created_at  TIMESTAMP DEFAULT now()
```

#### `usage_daily`
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE
date        DATE NOT NULL DEFAULT CURRENT_DATE
reply_count INTEGER NOT NULL DEFAULT 0
UNIQUE(user_id, date)
```

### 6.2 Relationships

```
users 1 → N products
users 1 → N delivery_zones
users 1 → 1 subscriptions
users 1 → N usage_daily
products 1 → N variants
```

### 6.3 Tables That Were Removed
- `delivery_settings` — dropped. `delivery_zones` is the only delivery system.

### 6.4 Indexes
```sql
CREATE INDEX idx_delivery_zones_user_id ON delivery_zones(user_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_usage_daily_user_date ON usage_daily(user_id, date);
```

---

## 7. API Design

### 7.1 Global Conventions

| Convention | Value |
|---|---|
| Base URL (local) | `http://localhost:4000/api` |
| Base URL (production) | `https://your-app.vercel.app/api` |
| Auth header | `Authorization: Bearer <jwt_token>` |
| Content-Type | `application/json` |
| Token expiry | 7 days |
| Error format | `{ "error": "message" }` |
| Paywall error | `{ "error": "Daily limit reached", "upgrade": true }` |

### 7.2 Auth Routes (`/api/auth`)

| Method | Endpoint | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/signup` | Public | `{ name, email, password }` | `{ token, user }` |
| POST | `/auth/login` | Public | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | Required | — | `{ user }` |

### 7.3 Product Routes (`/api/products`)

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/products` | Required | Returns `id, name, price, keywords, notes` |
| POST | `/products` | Required | checkProductLimit middleware applied |
| PATCH | `/products/:id` | Required | Partial update, ownership enforced |
| DELETE | `/products/:id` | Required | Also deletes all variants (CASCADE) |

### 7.4 Variant Routes (`/api`)

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/products/:productId/variants` | Required | Ownership verified |
| POST | `/products/:productId/variants` | Required | Body: `{ color, size, available? }` |
| PATCH | `/variants/:variantId` | Required | Ownership via JOIN through products |

### 7.5 Delivery Zone Routes (`/api`)

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/delivery-zones` | Required | All zones for this seller |
| POST | `/delivery-zones` | Required | Body: `{ name, price, codAvailable? }` |
| PATCH | `/delivery-zones/:id` | Required | Partial update |
| DELETE | `/delivery-zones/:id` | Required | |

### 7.6 AI Route (`/api/ai`)

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/ai/suggest-reply` | Required + checkReplyLimit | Body: `{ customerMessage, tone? }` |

### 7.7 Payment Routes (`/api/payments`)

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/payments/plans` | Required | Returns current plan + usage + pricing |
| POST | `/payments/esewa/initiate` | Required | Body: `{ billing: 'monthly'|'yearly' }` |
| POST | `/payments/esewa/verify` | Required | Body: `{ encodedData, billing }` |

---

## 8. AI System — The Core Product

### 8.1 System Prompt Location
`backend/src/ai/systemprompt.ts`

### 8.2 How Product Matching Works
1. `resolveProductContext()` checks product name (exact/partial) then keywords
2. If match → `productKnown: true`, `matchedProduct: string`
3. If no match → `productKnown: false` → ASK action
4. Clarification reply is Groq-generated, not hardcoded

### 8.3 The 14 Reply Rules (Summary)

| Rule | Trigger | Reply Style |
|---|---|---|
| 1 | Price only | Price only, no emoji |
| 2 | Specific variant available | "Cha hajur 😊" + variant + price |
| 3 | Variant unavailable, others exist | State unavailable + list available |
| 4 | General availability | "Cha hajur 😊" or "sold out" |
| 5 | Delivery asked | List all zones with exact prices |
| 6 | COD asked | "COD available cha" or "chaina" |
| 7 | Greeting only | "Hajur 😊" only |
| 8 | Combo question | Answer all parts, 3 sentences max |
| 9 | Discount/bargain | "Price fixed cha" — polite, short |
| 10 | Quantity/bulk | Safe fallback to seller |
| 11 | How to order | Safe fallback to seller |
| 12 | Quality/fabric | Use notes if available, else fallback |
| 13 | Return/exchange | Redirect to seller |
| 14 | Off-topic/irrelevant | "Seller lai directly message garnu hola" |

### 8.4 Groq Configuration
```typescript
model: "llama-3.3-70b-versatile"
temperature: 0.3
```

### 8.5 Critical Language Rules
- `"Cha hajur 😊"` — ONLY for confirming availability
- `"Hajur 😊"` — ONLY for greeting-only messages
- NEVER bhai, dai, didi, sir, madam
- NEVER Devanagari script

---

## 9. Monetization

### 9.1 Pricing

| Plan | Price | Limits |
|---|---|---|
| Free | Rs. 0/month | 20 replies/day, 5 products |
| Pro Monthly | Rs. 299/month | Unlimited |
| Pro Yearly | Rs. 2,499/year | Unlimited, save 30% |

### 9.2 eSewa Integration (Built ✅)
- epay v2 API
- HMAC-SHA256 signature verification
- Sandbox: `https://rc-epay.esewa.com.np/api/epay/main/v2/form`
- Production: `https://epay.esewa.com.np/api/epay/main/v2/form`
- Success redirect → `/payment/success?data=[base64]`
- Backend verifies → upserts subscriptions table

### 9.3 Plan Enforcement (Built ✅)
```
Reply limit:    checkReplyLimit on POST /ai/suggest-reply
Product limit:  checkProductLimit on POST /products
Counter:        usage_daily table via incrementReplyCount()
Pro check:      subscriptions — plan + status + expires_at
```

---

## 10. Security

### 10.1 Currently Implemented
- bcrypt passwords (10 rounds)
- JWT HS256, 7-day expiry
- JWT middleware on all protected routes
- Variant/product/delivery zone ownership checks
- eSewa HMAC-SHA256 signature verification
- Plan limits enforced server-side

### 10.2 Still Needed (Phase 3)
- Rate limiting on /auth/login (brute force)
- Input validation (Zod)
- CORS restricted to known origins (currently `*`)
- Helmet.js HTTP headers
- Max length on customerMessage (2,000 chars)
- Duplicate payment prevention

---

## 11. Development Roadmap

### Phase 1 — Web MVP ✅
### Phase 2 — Monetization ✅ (Built, deploying)
- eSewa ✅, subscriptions ✅, checkPlan ✅, upgrade page ✅, paywall ✅, landing ✅
- **Remaining:** Deploy Vercel backend, test eSewa production, add Khalti

### Phase 3 — Polish + Growth
- Khalti, Tailwind UI, reply templates, Sentry, PostHog, rate limiting

### Phase 4 — Mobile
- Flutter login, feature parity, Share Sheet, app stores

### Phase 5 — Automation
- WhatsApp API, Instagram API, auto-reply queue, team accounts

---

## 12. DevOps

### 12.1 Local Development
```bash
docker-compose up -d          # start PostgreSQL
cd backend && npm run dev     # :4000
cd web && npm run dev         # :3000
```

### 12.2 Production

| Service | Platform | Status |
|---|---|---|
| Frontend | Vercel | ✅ Deployed |
| Backend | Vercel serverless | ⏳ In progress |
| Database | Neon PostgreSQL | ✅ Live |

### 12.3 Vercel Backend Setup
```
Root directory: backend
Build command:  npm run build
Entry point:    backend/api/[...path].ts → imports src/app.ts
```

### 12.4 package.json Scripts
```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "vercel-build": "tsc"
}
```

---

## 13. Monitoring & Logging

### 13.1 Current
- `console.error()` in all routes
- `/api/debug` — env var status + DB connection
- `/health` — `{ status: "ok" }`
- Vercel dashboard logs

### 13.2 Error Fix Workflow
```
1. Vercel dashboard → Logs → filter Error
2. Copy error + stack trace
3. Claude with MASTER.md → paste error + file → get fix
4. Fix locally → test → push → auto-deploy
```

### 13.3 Planned (Phase 3)
- Sentry, Winston, PostHog

---

## 14. Scaling Strategy

### 14.1 Current
- Vercel serverless (auto-scales)
- pg Pool max 5 connections to Neon
- Groq scales automatically

### 14.2 By Load

| Users (MAU) | Strategy |
|---|---|
| 0–1,000 | Vercel free + Neon free |
| 1,000–10,000 | Upgrade Neon. Add Redis rate limiting. |
| 10,000–50,000 | Dedicated backend. Read replica. |
| 50,000+ | Kubernetes, DB sharding, CDN |

---

## 15. Known Issues & Technical Debt

| Issue | Severity | Fix When |
|---|---|---|
| Flutter hardcoded JWT token | 🔴 High | When resuming Flutter |
| Flutter hardcoded IP | 🔴 High | When resuming Flutter |
| Vercel tsconfig needs fixing for serverless | 🔴 High | Now |
| No rate limiting on /auth/login | 🟡 Medium | Phase 3 |
| No input validation (Zod) | 🟡 Medium | Phase 3 |
| CORS allows all origins | 🟡 Medium | Before launch |
| No max length on customerMessage | 🟡 Medium | Phase 3 |
| No duplicate payment prevention | 🟡 Medium | Before eSewa goes live |
| eSewa only sandbox tested | 🟡 Medium | Test after deployment |
| Khalti not built | 🟡 Medium | Phase 3 |
| No Sentry | 🟡 Medium | Phase 3 |

---

## 16. How to Use This Document with AI

```
"Using the project spec below as your source of truth:
[PASTE MASTER.md]

Rules:
- Tech stack from Document Metadata only
- DB schema from Section 6 exactly
- API conventions from Section 7
- Groq NOT OpenAI
- Raw pg NOT Prisma
- ESM imports with .js extensions
- No new tables not in Section 6
- Errors: { error: 'message' }
- Paywall errors: { error: '...', upgrade: true }"
```

### Critical Facts — Never Forget
1. **No Prisma** — raw `pg` Pool
2. **Groq not OpenAI** — `groq-sdk`, `llama-3.3-70b-versatile`
3. **ESM imports** — `.js` extensions required
4. **No product selector** — AI auto-matches
5. **Romanized Nepali only** — never Devanagari
6. **Never bhai/dai/didi** — always "Hajur"
7. **Variants = individual rows** — one color + one size
8. **delivery_settings GONE** — only `delivery_zones`
9. **JWT 7-day** — localStorage (web)
10. **Neon needs SSL** — `ssl: { rejectUnauthorized: false }`
11. **Payment built** — subscriptions + usage_daily + checkPlan middleware
12. **Paywall response** — `{ error: "Daily limit reached", upgrade: true }`