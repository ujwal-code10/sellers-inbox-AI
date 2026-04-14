# Ship Testing Guide (Simple Step-by-Step)

Use this before giving access to real sellers.

## 1. Pre-Flight (5 minutes)
1. Start backend and web.
2. Confirm backend health at `/health` returns `{ "status": "ok" }`.
3. Sign up one seller test account.
4. Log in to admin with super admin account.
5. Ensure manual QR config is visible in Upgrade page.

## 2. Seller Flow QA (Core Experience)

### A. Account
1. Signup with new email.
2. Logout and login again.
3. Refresh browser and confirm session still works.
Expected:
- User remains authenticated by cookie session.
- No token error popup.

### B. Product Setup (Top-20 approach)
1. Add 3 to 5 products first (not full catalog).
2. Add variants for at least 2 products.
3. Mark one variant unavailable.
Expected:
- Product and variant changes are saved.
- Stock badges update correctly.

### C. AI Reply: Clear Message
1. Paste: `Blue hoodie M size cha? price kati?`
2. Click Generate.
Expected:
- Direct REPLY action.
- Correct product/variant and price.

### D. AI Reply: First Vague Message (Cold Start)
1. Clear context.
2. Paste: `pp`
3. Click Generate.
Expected:
- ASK response appears.
- Quick picks are shown immediately.
- Search is optional fallback.

### E. Forced Product Recovery
1. From vague result, click one quick-pick product.
Expected:
- Regenerated reply uses selected product.
- No repeated clarification like `Kun product bare...`.

### F. Cha Hajur Placement
1. Test price-only: `pp` + selected product.
Expected:
- Price-only reply without `Cha hajur`.
2. Test availability: `yo blue M cha?`
Expected:
- `Cha hajur` allowed only in availability context.

### G. Free Plan Limits
1. Use reply generation repeatedly to hit limit.
2. Add products until free product limit.
Expected:
- Proper paywall messages.
- No silent failures.

### H. Context Memory V1 (Follow-up Behavior)
1. In Customer A slot, ask: `pp` and select a product.
2. In same slot, ask follow-up: `s size ma cha`.
3. In same slot, ask: `blue color ma cha`.
4. In same slot, ask combo: `blue color ma cha, price kati`.
Expected:
- Follow-up availability replies stay concise.
- Follow-up availability does not force `Cha hajur`.
- Size-only question should focus on size (not list all colors).
- Color-only question should focus on color (not list all sizes).
- Combo availability + price can include both availability and price.

## 3. Payment QA (Manual QR)

### Seller-side
1. Open Upgrade page.
2. Select monthly/yearly.
3. Submit test payment request with:
- payment reference
- payer name
- optional note
Expected:
- Request status becomes pending.
- Seller sees pending state and cannot submit duplicate pending request.

### Important note
- Current MVP does not have screenshot file upload in-app.
- Proof is handled by reference + payer name + optional note.

## 4. Admin Operations Guide (Professional SOP)

### A. Daily payment review
1. Go to Admin -> Transactions.
2. Filter `status = pending` and `payment_method = manual_qr`.
3. Open each request.
4. Verify reference against wallet records.
5. Approve valid requests.
6. Reject invalid requests with clear reason.
Expected:
- Approve activates seller Pro subscription.
- Reject returns actionable reason.

### B. Admin account security
1. Admin -> Settings -> Change Password.
2. Admin -> Settings -> Change Email.
Expected:
- Both actions force re-login (session revocation).

### C. Team admin management (super admin)
1. Admin -> Settings -> Create Admin User.
2. Create normal admin first.
3. Share temporary password securely.
4. Ask new admin to change password immediately.

### D. System settings control
1. Admin -> Settings -> update JSON values only if understood.
2. Keep change notes in internal ops log.

## 5. Launch-Day Checklist
1. Manual QR env values configured in production.
2. At least 20 high-demand products entered for demo seller.
3. One full payment approval flow tested end-to-end.
4. One rejection flow tested end-to-end.
5. One vague message flow tested end-to-end.
6. Super admin account recovery credentials stored safely.

## 6. Week-1 Production Monitoring
1. Track top unclear messages (`pp`, `yo cha`, `kati`) and check quick-pick usefulness.
2. Track payment pending queue time.
3. Track seller drop-offs during product setup.
4. Add products gradually based on real inquiries, not full catalog migration.
5. Track reply edit pattern for prompt tuning:
- Did seller send reply as-is?
- Did seller add price?
- Did seller remove price?
- Did seller add variant detail?
- Did seller shorten long reply?
