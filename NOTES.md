# Learning Notes

Use this file for structured break/observe/fix notes.
Each entry follows the same template for fast review.

---

## Lesson 7 - Layer Study (Login Flow) - Schema

Context:
- This is a layer-study using the login flow to understand boundaries; the main Lesson 7 feature is rate limiting.

What I broke:
- Allowed non-string email to pass schema validation in login.

What happened:
- email: 123 (number) -> 400 Bad Request.
- email: "123" (string) -> passed schema, then 401 Invalid credentials.

Why it happened (WHAT + WHY + WHERE):
- WHAT: schema validates input shape and types.
- WHY: prevents malformed input from reaching business logic and DB.
- WHERE: between controller and service.

Fix:
- Restore strict type checks for email/password in login schema.

Interview answer:
- Schema validation is the first security gate. It enforces input rules before business logic runs, so bad data never reaches the database or breaks logic.

Keywords:
- validation boundary, never trust frontend, input shape, type checks

---

## Lesson 7 - Layer Study (Login Flow) - Controller

Context:
- This is a layer-study using the login flow to understand boundaries; the main Lesson 7 feature is rate limiting.

What I broke:
- Forced login controller to return a 500 response even after successful auth.

What happened:
- Correct credentials still returned 500 with a forced error message.

Why it happened (WHAT + WHY + WHERE):
- WHAT: controller decides the HTTP status and response body.
- WHY: it is the last step before the response goes back to the client.
- WHERE: after service returns and before response is sent.

Fix:
- Restore controller to return the normal success response.

Interview answer:
- The controller is the response boundary. Even if the service succeeds, the controller can still return an error, so it must map outcomes to the correct HTTP status.

Keywords:
- response mapping, status codes, controller boundary

---

## Lesson 7 - Layer Study (Login Flow) - Middleware

Context:
- This is a layer-study using the login flow to understand boundaries; the main Lesson 7 feature is rate limiting.

What I broke:
- Forced auth middleware to return 401 instead of calling next().

What happened:
- All protected routes returned 401 even with valid login.

Why it happened (WHAT + WHY + WHERE):
- WHAT: middleware is a gate that decides if the request can reach controllers.
- WHY: it enforces auth and CSRF before any business logic runs.
- WHERE: right after the route and before the controller.

Fix:
- Restore next() so requests can proceed when valid.

Interview answer:
- Middleware is the gatekeeper. It blocks unauthenticated or unsafe requests before they reach controllers, so a bug here breaks every protected endpoint.

Keywords:
- auth gate, pre-handler checks, request pipeline

---

## Lesson 8 - CORS (Browser Security)

What I broke:
- No hard break yet; observed CORS behavior from different origins.

What happened:
- Same-origin (http://localhost:4000/health) -> success.
- about:blank (origin "null") -> Failed to fetch (CORS blocked).
- App page console -> CSP blocked fetch (not CORS).

Why it happened (WHAT + WHY + WHERE):
- WHAT: CORS is a browser rule that restricts which origins can read responses.
- WHY: prevents other sites from reading private API data using your cookies.
- WHERE: enforced by the browser after the server response.

Fix:
- Configure allow-list origins (FRONTEND_URL, CORS_ORIGINS, dev localhost) as needed.

Interview answer:
- CORS is a browser-enforced policy that blocks cross-site JS from reading API responses. It does not secure the API itself; servers and tools like curl bypass it.

Keywords:
- CORS, origin allow-list, browser enforcement, response blocking

---

## Lesson 9 - Database Indexes

What I broke:
- No explicit break; observed baseline query plan without index benefits.

What happened:
- Before: Seq Scan on products for user_id = 1 (table was small and filter matched most rows).
- After adding index + ANALYZE: Index Scan used for user_id = 3 (selective filter).

Why it happened (WHAT + WHY + WHERE):
- WHAT: indexes are btree shortcuts for selective filters (e.g., user_id).
- WHY: the planner chooses the cheapest plan; indexes help only when few rows match.
- WHERE: enforced by the query planner during EXPLAIN ANALYZE.

Fix:
- Add index on products(user_id) and validate with EXPLAIN ANALYZE.

Interview answer:
- I used EXPLAIN ANALYZE to compare Seq Scan vs Index Scan. The index only helped when the filter was selective, proving the planner picks the cheapest plan based on data size.

Keywords:
- index scan, seq scan, selectivity, query planner, EXPLAIN ANALYZE

---

## Lesson 1 - N+1 Query Problem

What I broke:
- Replaced the single JOIN query with one query per product to load variants (N+1).

What happened:
- Products page triggered multiple variant queries; log showed N+1 (e.g., 3 extra queries for 3 products).

Why it happened (WHAT + WHY + WHERE):
- WHAT: N+1 happens when code loops and queries inside the loop.
- WHY: per-product variant queries scale linearly and slow down as product count grows.
- WHERE: repository layer for GET /api/products.

Fix:
- Restore a single JOIN + aggregation query to fetch products and variants in one round-trip.

Interview answer:
- I reproduced an N+1 by querying variants per product, then fixed it with a single JOIN. This reduced queries from 1+N to 1 and scales much better.

Keywords:
- N+1, JOIN, aggregation, query count

---

## Lesson 10 - Caching Strategy (Frontend)

What I broke:
- Disabled cached initial data for Products and Delivery tabs to force re-fetches.

What happened:
- Switching tabs triggered repeated GET /api/products and GET /api/delivery-zones.

Why it happened (WHAT + WHY + WHERE):
- WHAT: without client cache, every tab visit re-requests the same data.
- WHY: repeated fetches add latency and extra backend load for unchanged data.
- WHERE: frontend state in Dashboard tabs (initialData + cached state).

Fix:
- Restore cached initial data so tab switching reuses in-memory data.

Interview answer:
- I proved redundant requests by disabling cache, then restored cached state. Caching is safe for slow-changing data when invalidated on create/update/delete.

Keywords:
- client cache, state reuse, invalidation, redundant requests

---

## Template

Lesson / Layer:
What I broke:
What happened:
Why it happened (WHAT + WHY + WHERE):
Fix:
Interview answer:
Keywords:
