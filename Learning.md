# LEARNING.md — Backend Engineering Curriculum

Goal: Strong backend knowledge, system design, debugging skills.
Method: Break -> Observe -> Fix -> Understand -> Document.

## Break-Observe-Fix Protocol (Required)
1. Pick one layer to break (schema, service, repository, controller, or middleware).
2. Make a small, reversible break that isolates that layer.
3. Run one manual test and capture the exact error/status.
4. Fix immediately and re-run to confirm recovery.
5. Trace the code path using docs/LAYER_BY_LAYER_STUDY_GUIDE.md.
6. Write a 3-line summary in LEARNING_PROGRESS.md (what you did, what happened, why).

## Files Used
- LEARNING.md: curriculum and lesson instructions only.
- LEARNING_PROGRESS.md: evidence, results, root cause, and reusable patterns.
- docs/LAYER_BY_LAYER_STUDY_GUIDE.md: strict code path walkthrough.

## Lesson Workflow (Applies to Every Lesson)
1. Break one layer.
2. Observe and record the exact behavior.
3. Fix and confirm the behavior returns to normal.
4. Trace the path layer-by-layer.
5. Log the 3-line summary in LEARNING_PROGRESS.md.

---

## Fullstack Eligibility Checklist (Quick Reference)

Minimum to apply (Fullstack Intern):
- Lesson 1: N+1 Query Problem
- Lesson 2: Validation boundary
- Lesson 3: JWT signing vs tampering
- Lesson 4: Authorization / IDOR checks
- Lesson 8: CORS (frontend <-> backend security)
- Lesson 10: Caching strategy (frontend performance)
- Lesson 12: Error handling (safe failures)

Strong security bonus (pick one):
- Lesson 6: SQL Injection
- Lesson 7: Rate limiting

---

## PHASE 1 — Backend Fundamentals

### Lesson 1: N+1 Query Problem ⏳
Concept: Multiple DB queries when one would do.
Where: GET /api/products.
Task:
1. Add a log before each pool.query in products route.
2. Load Products tab and count queries.
3. Replace with a single JOIN and re-test.
Done? [ ]
Time spent: ___
What I learned: ___

---

### Lesson 2: Never Trust the Frontend ⏳
Concept: Frontend validation is UX; backend validation is security.
Where: POST /api/products, POST /api/delivery-zones.
Task:
1. Replay a valid request from DevTools.
2. Break: send invalid values (negative price, wrong type, empty name).
3. Fix: enforce schema validation and confirm 400s.
Done? [x]
Time spent: ___
What I learned: ___

---

### Lesson 3: JWT — What It Actually Does ⏳
Concept: JWT is signed, not encrypted.
Where: backend/src/middleware/auth.ts.
Task:
1. Inspect token payload on jwt.io.
2. Break: tamper payload/signature and replay request.
3. Fix: verify signature rejects tampering.
Done? [ ]
Time spent: ___
What I learned: ___

---

### Lesson 4: Authorization — Who Can Do What ⏳
Concept: Authentication = who you are; authorization = what you can do.
Where: routes with :id parameters.
Task:
1. Create userA and userB.
2. Break: try to access userA resources as userB.
3. Fix: ensure all queries enforce user_id ownership.
Done? [ ]
Time spent: ___
What I learned: ___

---

### Lesson 5: Race Conditions ⏳
Concept: Simultaneous requests can corrupt data.
Where: usage_daily increment, variant toggle.
Task:
1. Break: fire multiple requests at once.
2. Observe lost updates or last-write-wins.
3. Fix: atomic upsert or optimistic locking.
Done? [ ]
Time spent: ___
What I learned: ___

---

## PHASE 2 — Security

### Lesson 6: SQL Injection ⏳
Concept: User input executed as SQL is dangerous.
Where: all pool.query calls.
Task:
1. Break: try classic injection payloads.
2. Observe whether queries are parameterized.
3. Fix: replace string concatenation with parameters.
Done? [ ]
Time spent: ___
What I learned: ___

---

### Lesson 7: Rate Limiting Reality ⏳
Concept: Without limits your app is abusable.
Where: auth routes, AI usage gate.
Task:
1. Break: brute-force login attempts.
2. Break: exceed daily AI reply limit.
3. Fix: verify limiter config and DB-backed counters.
Done? [ ]
Time spent: ___
What I learned: ___

---

### Lesson 8: CORS — What It Actually Does ⏳
Concept: CORS is browser security, not server security.
Where: backend/src/app.ts (cors config).
Task:
1. Break: attempt cross-origin browser request.
2. Observe CORS failure in browser (not Postman).
3. Fix: restrict allowed origins and keep localhost working.
Done? [ ]
Time spent: ___
What I learned: ___

---

## PHASE 3 — Performance

### Lesson 9: Database Indexes ⏳
Concept: Indexes speed reads at the cost of writes.
Where: products table queries.
Task:
1. Run EXPLAIN ANALYZE before and after adding index.
2. Observe Seq Scan vs Index Scan.
3. Fix: add missing index on user_id.
Done? [ ]
Time spent: ___
What I learned: ___

---

### Lesson 10: Caching Strategy ⏳
Concept: Not everything needs a fresh DB query.
Where: dashboard product/zone fetching.
Task:
1. Break: count repeated queries on tab switches.
2. Observe redundant fetches.
3. Fix: cache in React state and invalidate when needed.
Done? [ ]
Time spent: ___
What I learned: ___

---

## PHASE 4 — System Design

### Lesson 11: Design Context Memory System ⏳
Concept: Stateful vs stateless systems, TTL, session design.
Where: new feature design.
Task:
1. Design storage options and trade-offs.
2. Break: list edge cases that fail.
3. Fix: choose schema and expiry strategy.
Done? [ ]
Time spent: ___
What I learned: ___

---

### Lesson 12: Error Handling — What Happens When Things Fail ⏳
Concept: External services fail; you must handle it safely.
Where: AI and DB integration paths.
Task:
1. Break: misconfigure API key/DB URL.
2. Observe user-facing errors and status codes.
3. Fix: return safe errors without leaking internals.
Done? [ ]
Time spent: ___
What I learned: ___

---

## PHASE 5 — Advanced

### Lesson 13: Load Testing ⏳
### Lesson 14: Database Transactions ⏳
### Lesson 15: Background Jobs ⏳
### Lesson 16: Structured Logging ⏳
### Lesson 17: API Versioning ⏳
### Lesson 18: Feature Flags ⏳

---

## How to Start Each Copilot Agent Session

Copy and paste this at the start:

```
Read my full codebase and LEARNING.md carefully.
I am doing Lesson [X]: [Lesson Name].
Follow the Break-Observe-Fix protocol exactly.
Do not just fix things -- explain what is happening at each layer.
After fixing, help me write the 3-line summary in LEARNING_PROGRESS.md.
```
