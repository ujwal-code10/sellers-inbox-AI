# API Contract (Current MVP)

Source of truth: [MASTER_SPEC.md](../MASTER_SPEC.md), Section 7.

## Base and Conventions
- Base URL (local): http://localhost:4000/api
- Auth header: Authorization: Bearer <token>
- Token expiry: 7 days
- Standard error: { "error": "message" }
- Paywall error: { "error": "...", "upgrade": true }

This API powers an AI-assisted reply tool, not a full inbox automation system.

## Health
GET /health

Response:
{
  "status": "ok"
}

## Auth (/auth)
- POST /auth/signup
  - Request: { name, email, password }
  - Response: { token, user }
- POST /auth/login
  - Request: { email, password }
  - Response: { token, user }
- GET /auth/me
  - Response: { user }

## Products (/products)
- GET /products
  - List seller products
- POST /products
  - Create product
  - checkProductLimit middleware applies for Free plan
- PATCH /products/:id
  - Update owned product
- DELETE /products/:id
  - Delete owned product and cascade variants

## Variants (/api)
- GET /products/:id/variants
  - List variants for owned product
- POST /products/:id/variants
  - Request: { color, size, available? }
- PATCH /variants/:id
  - Request: { available: boolean }
  - Ownership checked via product join

## Delivery Zones (/api)
- GET /delivery-zones
- POST /delivery-zones
- PATCH /delivery-zones/:id
- DELETE /delivery-zones/:id

Notes:
- Only delivery_zones is valid.
- delivery_settings is removed.

## AI (/ai)
- POST /ai/suggest-reply
  - Request: { customerMessage, tone? }
  - checkReplyLimit middleware applies
  - Uses product + variant + delivery zone context
  - On success increments usage_daily

## Payments (/payments)
- GET /payments/plans
  - Returns current plan, usage, pricing
- POST /payments/esewa/initiate
  - Request: { billing: "monthly" | "yearly" }
- POST /payments/esewa/verify
  - Request: { encodedData, billing }

## Out of Scope (MVP)
- Auto-send replies
- Meta webhook inbox sync
- Full order management
