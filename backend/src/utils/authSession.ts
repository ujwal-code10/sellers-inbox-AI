import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import pool from "./db.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const COOKIE_NAMES = {
  sellerAccess: "seller_access_token",
  sellerRefresh: "seller_refresh_token",
  adminAccess: "admin_access_token",
  adminRefresh: "admin_refresh_token",
  csrf: "sia_csrf",
} as const;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const SELLER_ACCESS_TTL_SECONDS = 15 * 60;
export const SELLER_REFRESH_TTL_SECONDS = 14 * 24 * 60 * 60;
const ADMIN_ACCESS_TTL_SECONDS = 15 * 60;
export const ADMIN_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

const CSRF_COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60;

type SessionType = "user" | "admin";

interface CreateRefreshSessionParams {
  tokenType: SessionType;
  userId?: number;
  adminId?: number;
  ttlSeconds: number;
  ipAddress?: string;
  userAgent?: string | string[];
}

interface RotateRefreshSessionParams {
  currentToken: string;
  tokenType: SessionType;
  ttlSeconds: number;
  ipAddress?: string;
  userAgent?: string | string[];
}

interface RotatedSessionResult {
  token: string;
  userId?: number;
  adminId?: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not configured");
  }
  return secret;
}

function getAdminJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET not configured");
  }
  return secret;
}

function randomToken(size = 48): string {
  return crypto.randomBytes(size).toString("base64url");
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function baseCookieOptions() {
  return {
    secure: IS_PRODUCTION,
    sameSite: "lax" as const,
    path: "/",
  };
}

function secureCookieOptions(maxAgeSeconds: number) {
  return {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: maxAgeSeconds * 1000,
  };
}

function csrfCookieOptions() {
  return {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: CSRF_COOKIE_TTL_SECONDS * 1000,
  };
}

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function validateCsrfForCookieRequest(req: Request): boolean {
  const cookieToken = req.cookies?.[COOKIE_NAMES.csrf];
  const headerValue = req.headers["x-csrf-token"];

  const headerToken =
    typeof headerValue === "string"
      ? headerValue
      : Array.isArray(headerValue)
        ? headerValue[0]
        : undefined;

  if (
    !cookieToken ||
    typeof cookieToken !== "string" ||
    !headerToken ||
    typeof headerToken !== "string"
  ) {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}

export function issueCsrfCookie(res: Response): string {
  const csrfToken = randomToken(24);
  res.cookie(COOKIE_NAMES.csrf, csrfToken, csrfCookieOptions());
  return csrfToken;
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(COOKIE_NAMES.csrf, {
    ...baseCookieOptions(),
    httpOnly: false,
  });
}

export function signSellerAccessToken(userId: number): string {
  return jwt.sign({ id: userId, type: "user" }, getJwtSecret(), {
    expiresIn: `${SELLER_ACCESS_TTL_SECONDS}s`,
  });
}

export function signAdminAccessToken(adminId: number, role: string): string {
  return jwt.sign(
    { id: adminId, role, type: "admin" },
    getAdminJwtSecret(),
    {
      expiresIn: `${ADMIN_ACCESS_TTL_SECONDS}s`,
    }
  );
}

export function setSellerAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie(
    COOKIE_NAMES.sellerAccess,
    accessToken,
    secureCookieOptions(SELLER_ACCESS_TTL_SECONDS)
  );
  res.cookie(
    COOKIE_NAMES.sellerRefresh,
    refreshToken,
    secureCookieOptions(SELLER_REFRESH_TTL_SECONDS)
  );
}

export function clearSellerAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.sellerAccess, {
    ...baseCookieOptions(),
    httpOnly: true,
  });
  res.clearCookie(COOKIE_NAMES.sellerRefresh, {
    ...baseCookieOptions(),
    httpOnly: true,
  });
}

export function setAdminAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie(
    COOKIE_NAMES.adminAccess,
    accessToken,
    secureCookieOptions(ADMIN_ACCESS_TTL_SECONDS)
  );
  res.cookie(
    COOKIE_NAMES.adminRefresh,
    refreshToken,
    secureCookieOptions(ADMIN_REFRESH_TTL_SECONDS)
  );
}

export function clearAdminAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.adminAccess, {
    ...baseCookieOptions(),
    httpOnly: true,
  });
  res.clearCookie(COOKIE_NAMES.adminRefresh, {
    ...baseCookieOptions(),
    httpOnly: true,
  });
}

export async function createRefreshSession(
  params: CreateRefreshSessionParams
): Promise<{ token: string; sessionId: number }> {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000);

  const normalizedUserAgent = Array.isArray(params.userAgent)
    ? params.userAgent.join("; ")
    : params.userAgent;

  const result = await pool.query(
    `INSERT INTO auth_refresh_tokens
      (user_id, admin_id, token_hash, token_type, expires_at, created_ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.userId ?? null,
      params.adminId ?? null,
      tokenHash,
      params.tokenType,
      expiresAt,
      params.ipAddress ?? null,
      normalizedUserAgent ?? null,
    ]
  );

  return {
    token,
    sessionId: result.rows[0].id,
  };
}

export async function rotateRefreshSession(
  params: RotateRefreshSessionParams
): Promise<RotatedSessionResult | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentTokenHash = hashToken(params.currentToken);

    const currentResult = await client.query(
      `SELECT id, user_id, admin_id
       FROM auth_refresh_tokens
       WHERE token_hash = $1
         AND token_type = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [currentTokenHash, params.tokenType]
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const current = currentResult.rows[0] as {
      id: number;
      user_id: number | null;
      admin_id: number | null;
    };

    const newToken = randomToken();
    const newTokenHash = hashToken(newToken);
    const newExpiresAt = new Date(Date.now() + params.ttlSeconds * 1000);
    const normalizedUserAgent = Array.isArray(params.userAgent)
      ? params.userAgent.join("; ")
      : params.userAgent;

    const insertResult = await client.query(
      `INSERT INTO auth_refresh_tokens
        (user_id, admin_id, token_hash, token_type, expires_at, created_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        current.user_id,
        current.admin_id,
        newTokenHash,
        params.tokenType,
        newExpiresAt,
        params.ipAddress ?? null,
        normalizedUserAgent ?? null,
      ]
    );

    await client.query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = NOW(), replaced_by_id = $2
       WHERE id = $1`,
      [current.id, insertResult.rows[0].id]
    );

    await client.query("COMMIT");

    return {
      token: newToken,
      userId: current.user_id ?? undefined,
      adminId: current.admin_id ?? undefined,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function revokeRefreshSession(
  rawToken: string,
  tokenType: SessionType
): Promise<void> {
  const tokenHash = hashToken(rawToken);

  await pool.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND token_type = $2
       AND revoked_at IS NULL`,
    [tokenHash, tokenType]
  );
}

export async function revokeAllRefreshSessionsForAdmin(
  adminId: number
): Promise<void> {
  await pool.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE admin_id = $1
       AND token_type = 'admin'
       AND revoked_at IS NULL`,
    [adminId]
  );
}
