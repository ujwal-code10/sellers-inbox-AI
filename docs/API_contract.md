# API Contract (MVP – Phase 1)

Base URL: /api

Auth:
- All protected routes require JWT
- Header format: Authorization: Bearer <token>

This API supports an AI-assisted reply tool.
This is NOT a full inbox and does NOT require Meta API in MVP.

---

## Health Check

GET /health

Response:
200 OK
{
  "status": "ok"
}

Purpose:
- Verify backend is running

---

## Authentication (Already Implemented)

POST /auth/signup  
POST /auth/login  
GET /auth/me  

Purpose:
- User authentication
- Session verification

---

## Products (NEXT FEATURE TO BUILD)

Products store static product info.
Created once, reused by AI.

### Create product
POST /products (protected)

Request:
{
  "name": "Hoodie",
  "price": 2200
}

Response:
201 Created
{
  "id": 1,
  "name": "Hoodie",
  "price": 2200
}

Purpose:
- Create a base product

---

### Get seller products
GET /products (protected)

Response:
200 OK
[
  {
    "id": 1,
    "name": "Hoodie",
    "price": 2200
  }
]

Purpose:
- List seller’s products
- Used by AI suggestions

---

## Product Variants (STOCK CONTROL – LATER)

Variants represent dynamic availability.

POST /products/:productId/variants  
PATCH /variants/:variantId  

Purpose:
- Define sizes/colors
- Toggle availability ON/OFF
- Prevent AI from guessing stock

(Not implemented yet)

---

## Delivery Settings (LATER)

PUT /delivery-settings  

Purpose:
- Seller-defined delivery rules
- AI must never assume city/location

(Not implemented yet)

---

## AI Reply Assistant (CORE FEATURE – LATER)

POST /ai/suggest-reply  

Purpose:
- Generate reply suggestions only
- No auto-send
- Uses product + variant data

(Not implemented yet)

---

## Explicitly Out of MVP Scope

- Meta webhooks
- Instagram inbox sync
- Auto-send replies
- WhatsApp
- Order management

---

## MVP Success Criteria

- Seller enters product data once
- Seller can update stock quickly
- AI never lies about availability
- Replying is faster than typing manually
