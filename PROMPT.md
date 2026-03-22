# Seller Inbox AI — Saved Prompts

## 1. New Session Starter (use every time)
```
Read this MASTER.md completely before writing any code.
This is the full source of truth for my project.

[PASTE FULL MASTER.md]

Rules:
- Tech stack from Document Metadata only
- DB schema from Section 6 exactly
- Groq NOT OpenAI
- Raw pg NOT Prisma
- ESM imports with .js extensions
- No new tables not in Section 6
- Errors: { error: 'message' }
- Paywall: { error: '...', upgrade: true }
- Frontend = Vercel, Backend = Vercel serverless, DB = Neon
- Route file is payment.ts (no s)

Now help me with: [DESCRIBE WHAT YOU WANT]
```

---

## 2. Security Audit
```
Read this MASTER.md as source of truth:
[PASTE MASTER.md]

Do MVP security audit. Only flag issues that:
- Let user A access user B's data
- Allow free users to bypass paid limits
- Could crash the app in production
- Break payment verification

For each issue:
ISSUE: [title]
LEVEL: Critical / Important
FILE: [exact path]
ATTACK: [how exploited]
IMPACT: [what happens]
FIX: [exact code]

Audit these files one by one.
I will paste each file after you confirm ready.

Files:
1. backend/src/middleware/auth.ts
2. backend/src/middleware/checkPlan.ts
3. backend/src/routes/auth.ts
4. backend/src/routes/products.ts
5. backend/src/routes/variants.ts
6. backend/src/routes/payment.ts
7. backend/src/routes/ai.ts
8. backend/src/routes/delivery.ts

Reply YES when ready for file 1.
```

---

## 3. Build a Feature
```
Read this MASTER.md as source of truth:
[PASTE MASTER.md]

Build: [DESCRIBE FEATURE]

Requirements:
- [list what it should do]

Touch only these files:
- [list exact file paths]

Follow existing patterns in the codebase.
Use raw pg not Prisma.
ESM imports with .js extensions.
```

---

## 4. Fix a Bug
```
Read this MASTER.md:
[PASTE MASTER.md]

I got this error:
[PASTE EXACT ERROR]

This is the file where it happens:
[PASTE FILE CONTENT]

Fix it without changing anything else.
```

---

## 5. Update MASTER.md
```
Read my current MASTER.md:
[PASTE MASTER.md]

Update ONLY these specific things:
[LIST EXACT CHANGES]

Do not rewrite any sections.
Do not change anything not listed above.
Read the actual file — do not guess.
```

---

## 6. Find Sellers (DM Template)

**Nepali:**
```
Namaste! 😊

Ma ek free tool banako chu Nepali Instagram/WhatsApp 
sellers lai — customer messages ko AI reply generate 
garna Romanized Nepali ma. Completely free to try.

Try garna interest cha?
[YOUR VERCEL URL]
```

**English:**
```
Hey! I built a free AI tool for Nepali Instagram sellers 
— generates replies to customer messages in Romanized 
Nepali automatically. Would you try it and give feedback?

[YOUR VERCEL URL]
```

---

## 7. Instagram Hashtags to Find Sellers
```
#nepaliseller
#nepaliclothes
#kathmanduonlineshopping
#nepalistore
#nepalihandmade
#shopnepal
#onlineshoppingnepal
```
```

---

Create both files at:
```
C:\Projects\seller-inbox-ai\PROGRESS.md
C:\Projects\seller-inbox-ai\PROMPT.md