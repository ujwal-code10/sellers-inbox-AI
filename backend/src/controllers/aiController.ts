import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { AISchemaError, parseSuggestReplyBody } from "../schemas/aiSchemas.js";
import { AIServiceError, suggestReplyForUser } from "../services/aiReplyService.js";

function getAuthedUserId(req: AuthRequest): number | null {
  if (typeof req.userId !== "number") {
    return null;
  }

  return req.userId;
}

export async function suggestReplyHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const input = parseSuggestReplyBody(req.body);
    const response = await suggestReplyForUser({ userId, input });
    return res.json(response);
  } catch (err) {
    if (err instanceof AISchemaError || err instanceof AIServiceError) {
      return res.status(err.status).json({ error: err.message });
    }

    console.error("AI controller error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
