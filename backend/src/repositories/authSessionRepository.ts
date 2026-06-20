import pool from "../utils/db.js";

type RefreshSessionTokenType = "user" | "admin";

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

interface InsertRefreshSessionParams {
  userId: number | null;
  adminId: number | null;
  tokenHash: string;
  tokenType: RefreshSessionTokenType;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface RefreshSessionRow {
  id: number;
  user_id: number | null;
  admin_id: number | null;
}

export async function insertRefreshSession(params: InsertRefreshSessionParams): Promise<{
  id: number;
}> {
  const result = await pool.query(
    `INSERT INTO auth_refresh_tokens
      (user_id, admin_id, token_hash, token_type, expires_at, created_ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.userId,
      params.adminId,
      params.tokenHash,
      params.tokenType,
      params.expiresAt,
      params.ipAddress,
      params.userAgent,
    ]
  );

  return { id: result.rows[0].id as number };
}

export async function selectActiveRefreshSessionForUpdate(
  client: QueryExecutor,
  tokenHash: string,
  tokenType: RefreshSessionTokenType
): Promise<RefreshSessionRow | null> {
  // SOURCE: tokenHash is derived from presented refresh token in session rotation flow.
  // RISK: without row-level lock, concurrent refresh requests can both rotate same session.
  // PROTECTION: SELECT ... FOR UPDATE on active non-revoked token row.
  // RESULT: refresh rotation becomes single-winner and replay-safe.
  const result = await client.query(
    `SELECT id, user_id, admin_id
     FROM auth_refresh_tokens
     WHERE token_hash = $1
       AND token_type = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     FOR UPDATE`,
    [tokenHash, tokenType]
  );

  return (result.rows[0] as RefreshSessionRow | undefined) || null;
}

export async function insertRefreshSessionWithClient(
  client: QueryExecutor,
  params: InsertRefreshSessionParams
): Promise<{ id: number }> {
  const result = await client.query(
    `INSERT INTO auth_refresh_tokens
      (user_id, admin_id, token_hash, token_type, expires_at, created_ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.userId,
      params.adminId,
      params.tokenHash,
      params.tokenType,
      params.expiresAt,
      params.ipAddress,
      params.userAgent,
    ]
  );

  return { id: result.rows[0].id as number };
}

export async function markRefreshSessionRevokedWithReplacement(
  client: QueryExecutor,
  currentSessionId: number,
  replacementSessionId: number
): Promise<void> {
  await client.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW(), replaced_by_id = $2
     WHERE id = $1`,
    [currentSessionId, replacementSessionId]
  );
}

export async function revokeRefreshSessionByTokenHash(
  tokenHash: string,
  tokenType: RefreshSessionTokenType
): Promise<void> {
  await pool.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND token_type = $2
       AND revoked_at IS NULL`,
    [tokenHash, tokenType]
  );
}

export async function revokeAdminRefreshSessions(adminId: number): Promise<void> {
  await pool.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE admin_id = $1
       AND token_type = 'admin'
       AND revoked_at IS NULL`,
    [adminId]
  );
}