import express from "express";
import auth from "../middleware/auth.js";
import { checkReplyLimit } from "../middleware/checkPlan.js";
import { suggestReplyHandler } from "../controllers/aiController.js";

const router = express.Router();

router.post("/ai/suggest-reply", auth, checkReplyLimit, suggestReplyHandler);

export default router;
