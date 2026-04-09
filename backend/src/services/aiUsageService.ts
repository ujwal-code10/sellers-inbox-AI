import pool from "../utils/db.js";

interface LogAIUsageParams {
  userId: number;
  requestType: "suggest_reply" | "clarification";
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "failed";
  errorMessage?: string;
}

export async function logAIUsage(params: LogAIUsageParams): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ai_usage_logs
       (user_id, request_type, model, input_tokens, output_tokens, latency_ms, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.userId,
        params.requestType,
        "llama-3.3-70b-versatile",
        params.inputTokens,
        params.outputTokens,
        params.latencyMs,
        params.status,
        params.errorMessage || null,
      ]
    );
  } catch (err) {
    console.error("Failed to log AI usage:", err);
    // Non-blocking by design.
  }
}
