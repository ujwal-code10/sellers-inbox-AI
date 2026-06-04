import express from "express";
import auth from "../middleware/auth.js";
import { checkReplyLimit } from "../middleware/checkPlan.js";
import { suggestReplyHandler } from "../controllers/aiController.js";

const router = express.Router();

// SOURCE: AI suggestion requests originate from authenticated seller UI actions.
// RISK: calling AI without auth/plan checks can leak model usage and bypass limits.
// PROTECTION: enforce auth first, then apply reply-limit gate before controller executes.
// RESULT: AI generation stays scoped to authorized users and plan policy.
router.post("/ai/suggest-reply", auth, checkReplyLimit, suggestReplyHandler);

export default router;
