# Layer-by-Layer Study Guide (No Skip Order)

This guide is designed so you read the system in strict order.
If you jump to later steps first, you will miss why decisions exist.

## Rule 1: Never skip layers

Always read in this order:
1. Frontend trigger
2. Frontend API client
3. Backend route
4. Backend middleware
5. Backend controller
6. Backend schema parser
7. Backend service
8. Backend repository
9. Database table/migration assumptions

Do not move to the next layer until you can answer the checkpoint question for the current layer.

## Rule 2: How to read each file

For each file, find SOURCE/RISK/PROTECTION/RESULT comments first.
Then read the code below that comment.

## Flow A: Auth and session rotation

Step 1 (Frontend trigger):
- web/src/context/AuthContext.tsx

Checkpoint:
- Which actions call login, me, logout, refresh behavior?

Step 2 (Frontend API client):
- web/src/services/api/authApi.ts
- web/src/services/api/client.ts

Checkpoint:
- How are credentials and CSRF headers attached?
- How does refresh deduplication prevent racing refresh calls?

Step 3 (Route):
- backend/src/routes/auth.ts

Checkpoint:
- Which endpoints are rate-limited and which require auth middleware?

Step 4 (Middleware):
- backend/src/middleware/auth.ts

Checkpoint:
- When does CSRF validation run and why only for cookie-token unsafe methods?

Step 5 (Controller):
- backend/src/controllers/authController.ts

Checkpoint:
- How are refresh failures handled differently for transient vs invalid sessions?

Step 6 (Schema):
- backend/src/schemas/authSchemas.ts

Checkpoint:
- Which validation constraints are enforced before service logic?

Step 7 (Service):
- backend/src/services/authService.ts

Checkpoint:
- At which exact points are access and refresh tokens issued?

Step 8 (Repository):
- backend/src/repositories/authRepository.ts
- backend/src/repositories/authSessionRepository.ts

Checkpoint:
- How does SELECT FOR UPDATE in refresh flow prevent double-rotation?

Step 9 (Persistence assumptions):
- backend/src/migrations/create_auth_refresh_tokens.sql

Checkpoint:
- Which columns support revocation and replacement-chain tracking?

## Flow B: AI suggest reply (with forced product)

Step 1 (Frontend trigger):
- web/src/pages/Dashboard.tsx
- web/src/pages/dashboard/DashboardReplyTab.tsx

Checkpoint:
- Where do forcedProductId and followUpContext come from?

Step 2 (Frontend API client):
- web/src/services/api/aiApi.ts
- web/src/services/api/client.ts

Checkpoint:
- Which optional fields are included to preserve deterministic behavior?

Step 3 (Route):
- backend/src/routes/ai.ts

Checkpoint:
- Which middleware chain protects this route before controller execution?

Step 4 (Middleware):
- backend/src/middleware/auth.ts
- backend/src/middleware/checkPlan.ts (checkReplyLimit)

Checkpoint:
- Where is authorization checked and where is quota checked?

Step 5 (Controller):
- backend/src/controllers/aiController.ts

Checkpoint:
- What errors are mapped as 4xx vs 5xx?

Step 6 (Schema):
- backend/src/schemas/aiSchemas.ts

Checkpoint:
- What is normalized when source, hasMedia, recentProducts are absent?

Step 7 (Service):
- backend/src/services/aiReplyService.ts
- backend/src/decision/confidence.ts
- backend/src/decision/decisionEngine.ts

Checkpoint:
- Where is forced selection validated?
- When does deterministic reply path run instead of LLM?

Step 8 (Repository/data access):
- backend/src/services/aiReplyService.ts SQL sections
- backend/src/product/productResolver.ts

Checkpoint:
- How are product and variant rows scoped to user_id?

Step 9 (Persistence assumptions):
- backend/src/migrations/create_product_variant_perf_indexes.sql

Checkpoint:
- Which indexes support variant-heavy reply lookups?

## Flow C: Payments (manual QR and eSewa verify)

Step 1 (Frontend trigger):
- web/src/pages/Upgrade.tsx
- web/src/pages/PaymentSuccess.tsx

Checkpoint:
- Which fields are submitted for manual QR and verify actions?

Step 2 (Frontend API client):
- web/src/services/api/paymentApi.ts
- web/src/services/api/client.ts

Checkpoint:
- Why does verifyEsewa send encodedData only?

Step 3 (Route):
- backend/src/routes/payment.ts

Checkpoint:
- Which endpoints are auth-protected and which are rate-limited?

Step 4 (Middleware):
- backend/src/middleware/auth.ts

Checkpoint:
- Why can verify endpoint work without seller auth but still stay safe?

Step 5 (Controller):
- backend/src/controllers/paymentController.ts

Checkpoint:
- Where are schema/service errors separated from unexpected failures?

Step 6 (Schema):
- backend/src/schemas/paymentSchemas.ts

Checkpoint:
- Which manual QR constraints prevent bad references and empty payer names?

Step 7 (Service):
- backend/src/services/paymentService.ts

Checkpoint:
- How is billing derived from signed transaction_uuid during verify?
- How do advisory locks prevent duplicate manual QR submissions?

Step 8 (Repository):
- backend/src/repositories/paymentRepository.ts

Checkpoint:
- Which repository functions enforce uniqueness/idempotency behavior?

Step 9 (Persistence assumptions):
- backend/src/migrations/create_auth_refresh_tokens.sql
- transaction/subscription table usage in existing DB schema

Checkpoint:
- Which fields link transaction payment_ref to subscription payment_ref?

## Flow D: Product, variant, delivery CRUD

Step 1 (Frontend trigger):
- web/src/pages/Products.tsx
- web/src/services/api/productApi.ts
- web/src/services/api/deliveryApi.ts

Step 2 (Route):
- backend/src/routes/products.ts
- backend/src/routes/variants.ts
- backend/src/routes/delivery.ts

Step 3 (Controller):
- backend/src/controllers/productController.ts
- backend/src/controllers/variantController.ts
- backend/src/controllers/deliveryController.ts

Step 4 (Schema):
- backend/src/schemas/productSchemas.ts
- backend/src/schemas/variantSchemas.ts
- backend/src/schemas/deliverySchemas.ts

Step 5 (Service):
- backend/src/services/productService.ts
- backend/src/services/variantService.ts
- backend/src/services/deliveryService.ts

Step 6 (Repository):
- backend/src/repositories/productRepository.ts
- backend/src/repositories/variantRepository.ts
- backend/src/repositories/deliveryRepository.ts

Checkpoint:
- In each layer, identify exactly where user_id ownership is enforced.

## Weekly learning routine (job/intern prep)

Day 1:
- Complete Flow A only.

Day 2:
- Complete Flow B only.

Day 3:
- Complete Flow C only.

Day 4:
- Complete Flow D only.

Day 5:
- Re-explain all four flows without opening files, then verify with files.

## Anti-skip checklist

Before moving to the next step, answer all 3:
1. What is the trust source in this layer?
2. What failure risk is controlled in this layer?
3. What exact protection is implemented in this layer?
