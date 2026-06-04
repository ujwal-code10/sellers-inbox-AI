import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { AISchemaError, parseSuggestReplyBody } from "../schemas/aiSchemas.js";
import { AIServiceError, suggestReplyForUser } from "../services/aiReplyService.js";
import { getRequestId } from "../utils/requestContext.js";

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
    // SOURCE: request payload comes from authenticated seller dashboard API client.
    // RISK: unvalidated payload shape can break service assumptions and produce unsafe fallbacks.
    // PROTECTION: strict schema parse before invoking AI service orchestration.
    // RESULT: service receives normalized, typed input with bounded fields.
    const input = parseSuggestReplyBody(req.body);
    const response = await suggestReplyForUser({ userId, input });
    return res.json(response);
  } catch (err) {
    if (err instanceof AISchemaError || err instanceof AIServiceError) {
      return res.status(err.status).json({ error: err.message });
    }

    const requestId = getRequestId(req);
    console.error("AI controller error:", { requestId, err });
    return res.status(500).json({ error: "Server error", requestId });
  }
}
