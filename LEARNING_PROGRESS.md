# LEARNING_PROGRESS.md — Session Evidence and Learnings

Use this file for what you tested, observed, fixed, and learned.
Keep LEARNING.md for lesson flow and curriculum only.

## Session Entry Template

- Date:
- Lesson:
- Goal:
- Baseline checks:
- Break tests:
- Results (expected vs actual):
- Root cause:
- Fix applied:
- Reusable pattern:
- Next step:

---

## Fullstack Eligibility Checklist (Security-Focused)

Minimum to apply (Fullstack Intern):
- [ ] Lesson 1: N+1 Query Problem
- [x] Lesson 2: Validation boundary
- [x] Lesson 3: JWT signing vs tampering
- [x] Lesson 4: Authorization / IDOR checks
- [ ] Lesson 8: CORS (frontend <-> backend security)
- [ ] Lesson 10: Caching strategy (frontend performance)
- [ ] Lesson 12: Error handling (safe failures)

Strong security bonus (pick one):
- [ ] Lesson 6: SQL Injection
- [ ] Lesson 7: Rate limiting

Recommended next order:
1. Lesson 8 (CORS)
2. Lesson 12 (Error handling)
3. Lesson 10 (Caching)
4. Lesson 6 or 7 (security depth)

---


## Lesson 2 — Never Trust the Frontend (Completed)

- Date: 2026-04-25
- Goal: Prove backend is the real validation boundary for create endpoints.

- Baseline checks:
  - POST /api/products with valid payload -> 201
  - POST /api/delivery-zones with valid payload -> 201

- Break tests:
  - Invalid product and delivery payloads replayed outside UI.
  - Delivery invalid payloads returned 400.
  - Product quote-only name payload was initially accepted with 201, then fixed.

- Results (expected vs actual):
  - Valid create requests -> expected 201, got 201.
  - Invalid create requests -> expected 400, got 400 after schema hardening.

- Root cause:
  - Product name validation allowed punctuation-only values because non-empty trim check alone was insufficient.

- Fix applied:
  - Added meaningful-name validation requiring at least one letter or number in product name.
  - Added regression tests for quote-only and punctuation-only product names.

- Reusable pattern:
  - Frontend validation is UX; backend schema validation is the trust boundary.

- Next step:
  1. Do DB proof first (before Lesson 3).
  2. Record DB proof result in this file.
  3. Then start Lesson 3 (JWT).

- Current DB context from verification query:
  - db_name = neondb
  - db_user = neondb_owner
  - This indicates the current session is connected to Neon.

### DB Proof (Run This First)

### Which DB Should I Use?

Use this rule:
1. Learning, debugging, break/fix practice -> use LOCAL DB in Docker.
2. Production DB -> read-only checks only, no break/fix experiments.

Important:
- Docker runs the local PostgreSQL server.
- DBeaver is only a client tool; it can connect to both local and production.
- So it is not "Docker vs DBeaver". You use Docker + DBeaver together for local.

Local setup target for this project:
- Host: localhost
- Port: 5432
- Database: seller_inbox
- User: postgres
- Password: postgres

Backend must point to the same local DB during practice:
- Set `DATABASE_URL` to local Postgres connection.
- Restart backend after changing it.

Quick verification query (run in DBeaver SQL editor):

```sql
SELECT current_database() AS db_name,
       current_user AS db_user,
       inet_server_addr() AS server_ip,
       inet_server_port() AS server_port;
```

If result shows localhost/5432 (or Docker bridge local IP + 5432), you are on local DB.

### Full DB Picture (Run Before Proof Queries)

```sql
-- 1) List all public tables.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2) Approximate row counts per table.
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY relname;

-- 3) Columns and types for all public tables.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 4) Foreign-key relationships (how tables connect).
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 5) Indexes per table.
SELECT tablename AS table_name, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Expected outcome:
- You can see what tables exist, how much data they hold, how they connect, and how queries are accelerated.
- Then run DB proof queries to validate Lesson 2 protection.

Use your DB console (Neon/SQL editor) and run these checks:

```sql
-- Product edge-case from this lesson should not exist after fix.
SELECT COUNT(*) AS quote_only_products
FROM products
WHERE name = '""' AND price = 500;

-- Invalid create attempts should not produce impossible prices.
SELECT COUNT(*) AS non_positive_product_prices
FROM products
WHERE price <= 0;

SELECT COUNT(*) AS negative_delivery_prices
FROM delivery_zones
WHERE price < 0;
```

Expected meaning:
- `quote_only_products` should be `0`.
- Non-positive/negative price counts should not increase because of rejected requests.

After running, add one line here:
- DB proof result: <what you saw>

Current recorded result:
- DB proof interim (2026-04-26): `quote_only_5000 = 0` for query `WHERE name = '""' AND price = 5000`.
- Interpretation: no matching bad row currently exists for that exact value pair.
- Final proof still requires re-running the same query after an invalid API replay and confirming the count does not increase.

Then proceed to Lesson 3.

Lesson 2 result (simple):
- Where I did it: DevTools Network (Copy as cURL / replay), backend logs, and DBeaver SQL checks.
- What I did: replayed valid and invalid create requests for products and delivery zones.
- What happened: valid payloads returned 201; invalid payloads returned 400 after the fix.
- Root cause: product name check allowed punctuation-only names.
- Fix: require at least one letter or number in product name.
- Reusable pattern: backend validation is the real security boundary.

---

## Lesson 3 Kickoff (JWT) — Do This Next

1. Login once from web app.
2. Open DevTools -> Application -> Cookies.
3. Copy seller access token value for learning only (do not share publicly).
4. Paste token in jwt.io and inspect payload fields.
5. Observe one authenticated API call in Network (should succeed with valid token/cookie).
6. In API client/replay tool, send GET /api/products with modified token payload/signature.
7. Expected: 401 for modified token.
8. Record in this file:
  - valid token behavior
  - modified token behavior
  - one root cause sentence about signature verification

Lesson 3 result (simple):
- Where I did it: jwt.io for payload inspection, DevTools Application -> Cookies for token, and API replay tool for the request.
- What I did: inspected the JWT payload, then replayed a request with a modified token.
- What happened: valid token worked; modified token returned 401.
- Root cause: JWT is readable but tampering breaks the signature.

---

## Lesson 4 Kickoff (Authorization Audit) — Pattern First, Not Memorization

Goal:
- Prove userA cannot read/update/delete userB resources even with direct API calls.

What static audit already shows:
- `PATCH /api/products/:id` and `DELETE /api/products/:id` are user-scoped in repository queries (`WHERE id = ? AND user_id = ?`).
- `PATCH /api/delivery-zones/:id` and `DELETE /api/delivery-zones/:id` are user-scoped in repository queries.
- Variant routes are ownership-scoped through product join checks (`products.user_id`).

Why this still needs runtime tests:
- Static code can look correct but behavior can still fail due to integration mistakes.

Do this exact runtime test sequence:
1. Create `userA` and `userB` accounts.
2. Login as `userA` and create:
  - one product
  - one delivery zone
  - one variant
3. Save IDs from responses.
4. Login as `userB` and try:
  - `PATCH /api/products/{userA_product_id}`
  - `DELETE /api/products/{userA_product_id}`
  - `PATCH /api/delivery-zones/{userA_zone_id}`
  - `DELETE /api/delivery-zones/{userA_zone_id}`
  - `PATCH /api/variants/{userA_variant_id}`

Expected result:
- All cross-user mutations must fail (typically 404 or access denied equivalent).

Record results here:
- userA create responses:
- userB cross-user mutation responses:
- Root cause sentence:
- Reusable pattern:

Current recorded result (simple):
- Where I did it: DevTools Network (replay requests) and backend logs for status verification.
- What I did: made userA + userB, created data as userA, then tried to edit/delete userA data while logged in as userB.
- What happened: all cross-user requests returned 404.
- Root cause: the DB query always checks both `id` and `user_id`, so userB cannot touch userA rows.
- Reusable pattern: always add ownership checks in backend queries for every `:id` route.

---

## Lesson 7 — Rate Limiting (Completed)

Lesson 7 result (simple):
- Where I did it: DevTools Network for login and AI requests, plus DBeaver for `usage_daily`.
- What I did: 6 rapid failed logins and spammed AI replies until the free-tier limit.
- What happened: login returned 429 after 5 attempts (auth limiter max=5); AI returned 429 on the 4th reply with `limit=3` and `used=3`; DB `usage_daily.reply_count` matched.
- Root cause: express-rate-limit blocks auth floods; `checkReplyLimit` enforces daily usage by reading `usage_daily`.
- Reusable pattern: rate-limit public auth endpoints and enforce usage caps server-side with DB-backed counters.


Break-Observe-Fix pass (pending):
- Goal: feel each layer by intentionally breaking one layer at a time and restoring it.
- Why it matters: builds real system intuition and prepares for interview explanations of tradeoffs and failure modes.
- Schema break result: non-string email (email: 123) returned 400; string email ("123") passed schema and returned 401.
- What it proved: schema blocks malformed input before service auth checks run.
- Service break result: correct credentials still returned 401 when password check was forced to fail.
- What it proved: service layer decides auth outcome even after schema passes.
- Repository break result: correct credentials returned 401 when user lookup forced to return null.
- What it proved: repository controls whether service can find a user; failures look like invalid credentials.
- Controller break result: correct credentials returned 500 when controller forced an error response.
- What it proved: controller controls the final HTTP response even when service succeeds.
- Middleware break result: all protected routes returned 401 while auth middleware forced a block.
- What it proved: middleware is a gate before controllers; if it blocks, nothing else runs.
- Break-Observe-Fix pass: complete for Lesson 7.

---

## Lesson 8 — CORS (In Progress)

Lesson 8 result (simple):
- Where I did it: browser console (about:blank and same-origin page).
- What I did: fetch to http://localhost:4000/health from same origin and from origin "null".
- What happened: same-origin succeeded with {status: "ok"}; about:blank failed with "Failed to fetch" (CORS blocked).
- Root cause: CORS is enforced by the browser; disallowed origins cannot read responses.
- Reusable pattern: allow-list trusted frontend origins; remember CORS does not protect the API from server-side requests.

---

## Lesson 9 — Database Indexes (Completed)

Lesson 9 result (simple):
- Where I did it: DBeaver on local Postgres.
- What I did: ran EXPLAIN ANALYZE before/after adding idx_products_user_id; added test rows and ran ANALYZE.
- What happened: Seq Scan for user_id = 1 (non-selective); Index Scan for user_id = 3 (selective).
- Root cause: the planner chooses the cheapest plan; indexes only help when filters match few rows.
- Reusable pattern: validate index impact with EXPLAIN ANALYZE and ensure filters are selective.

---

## Lesson 1 — N+1 Query Problem (Completed)

Lesson 1 result (simple):
- Where I did it: backend repository for GET /api/products.
- What I did: introduced per-product variant queries (N+1), then restored the single JOIN query.
- What happened: logs showed multiple variant queries (e.g., 3 for 3 products); after fix, only one query path.
- Root cause: querying variants inside a loop creates 1+N queries and scales poorly.
- Reusable pattern: use JOIN + aggregation (or batch queries) to avoid per-row queries.

---

## Lesson 10 — Caching Strategy (Completed)

Lesson 10 result (simple):
- Where I did it: frontend Dashboard tab switching (Products, Delivery).
- What I did: disabled cached initial data to force re-fetches, then restored caching.
- What happened: repeated GET /api/products and /api/delivery-zones when cache was off; fewer requests after restore.
- Root cause: no cache means every tab visit re-fetches unchanged data.
- Reusable pattern: cache slow-changing data in state and invalidate on create/update/delete.
