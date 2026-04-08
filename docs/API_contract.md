# API Contract (Current MVP)

Source of truth: [MASTER_SPEC.md](../MASTER_SPEC.md)

## Base and Conventions
- Base URL (local): http://localhost:4000
- API prefix: `/api`
- Standard error: `{ "error": "message" }`
- Paywall error: `{ "error": "...", "upgrade": true }`

## Authentication Model
- Primary auth mode: HttpOnly cookie sessions (seller and admin)
- Access + refresh cookies are rotated server-side
- CSRF protection: `X-CSRF-Token` is required on unsafe methods when authenticated via cookies
- Authorization header support still exists for compatibility, but frontend should use cookie sessions

## Health
- GET `/health`
- Response: `{ "status": "ok" }`

## Seller Auth (`/api/auth`)
- POST `/signup`
  - Request: `{ name, email, password }`
  - Response: `{ user }` and auth cookies are set
- POST `/login`
  - Request: `{ email, password }`
  - Response: `{ user }` and auth cookies are set
- POST `/refresh`
  - Response: `{ success: true }` and rotated auth cookies
- POST `/logout`
  - Response: `{ message }` and cookies cleared
- GET `/me`
  - Response: `{ user }`
- PATCH `/me`
  - Request: `{ name }`
  - Response: `{ user }`
- POST `/forgot-password`
  - Request: `{ email }`
  - Response: generic success message (no account enumeration)

## Products (`/api/products`)
- GET `/products`
- POST `/products`
  - Request: `{ name, price, keywords?, notes? }`
  - Free-tier product limit enforced server-side
- PATCH `/products/:id`
- DELETE `/products/:id`

## Variants (`/api`)
- GET `/products/:id/variants`
- POST `/products/:id/variants`
  - Request: `{ color, size, available? }`
- PATCH `/variants/:id`
  - Request: `{ available }`

## Delivery Zones (`/api`)
- GET `/delivery-zones`
- POST `/delivery-zones`
- PATCH `/delivery-zones/:id`
- DELETE `/delivery-zones/:id`

## AI (`/api/ai`)
- POST `/ai/suggest-reply`
- Request:
```json
{
  "customerMessage": "pp",
  "tone": "friendly",
  "forcedProduct": "Blue Hoodie",
  "source": "DM",
  "hasMedia": false,
  "recentProducts": ["Blue Hoodie", "Black Hoodie"]
}
```
- Notes:
  - `checkReplyLimit` middleware is enforced
  - `forcedProduct` hard-locks reply generation for the selected product
  - For vague messages, ASK responses include quick product candidates
- Response shape:
```json
{
  "suggestions": ["reply text"],
  "decision": {
    "action": "ASK | REPLY",
    "reason": "...",
    "productKnown": true,
    "matchedProduct": "Blue Hoodie",
    "intent": "PRICE",
    "productCandidates": ["Blue Hoodie", "Black Hoodie"]
  }
}
```

## Payments (`/api/payments`)
- GET `/plans`
- GET `/manual-qr/config`
- GET `/manual-qr/status`
- POST `/manual-qr/submit`
  - Request: `{ billing, paymentReference, payerName, note? }`
  - Current MVP does not include screenshot file upload
  - Submission remains pending until admin approves/rejects
- POST `/esewa/initiate`
- POST `/esewa/verify`

## Admin (`/api/admin`)

### Admin Auth
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`
- GET `/auth/me`
- POST `/auth/change-password`
- POST `/auth/change-email`
- POST `/auth/create-admin` (super_admin only)

### Admin Operations
- `/users` - list/details/ban/unban/user usage/user transactions
- `/transactions` - list/stats/approve/reject manual QR submissions
- `/subscriptions` - list/update/grant/revoke
- `/ai-usage` - logs + stats + costs
- `/settings` - read and update system settings
- `/dashboard` - aggregated admin metrics

## Out of Scope (MVP)
- Auto-send replies
- Meta webhook inbox sync
- File upload storage for payment screenshot proof
- Full order management
