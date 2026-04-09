import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import {
  COOKIE_NAMES,
  clearCsrfCookie,
  clearSellerAuthCookies,
  isSafeMethod,
  issueCsrfCookie,
  setSellerAuthCookies,
  validateCsrfForCookieRequest,
} from "../utils/authSession.js";
import {
  AuthSchemaError,
  parseForgotPasswordBody,
  parseLoginBody,
  parseSignupBody,
  parseUpdateMeBody,
} from "../schemas/authSchemas.js";
import {
  AuthServiceError,
  getUserById,
  loginUser,
  requestPasswordReset,
  revokeSellerSession,
  rotateSellerSession,
  signupUser,
  updateUserName,
} from "../services/authService.js";

function getAuthedUserId(req: AuthRequest): number | null {
  return typeof req.userId === "number" ? req.userId : null;
}

function mapError(res: Response, err: unknown, logPrefix: string) {
  if (err instanceof AuthSchemaError || err instanceof AuthServiceError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(logPrefix, err);
  return res.status(500).json({ error: "Server error" });
}

export async function signupHandler(req: AuthRequest, res: Response) {
  try {
    const input = parseSignupBody(req.body);
    const result = await signupUser(input, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    setSellerAuthCookies(res, result.accessToken, result.refreshToken);
    issueCsrfCookie(res);

    return res.status(201).json({ user: result.user });
  } catch (err) {
    return mapError(res, err, "Signup error:");
  }
}

export async function loginHandler(req: AuthRequest, res: Response) {
  try {
    const input = parseLoginBody(req.body);
    const result = await loginUser(input, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    setSellerAuthCookies(res, result.accessToken, result.refreshToken);
    issueCsrfCookie(res);

    return res.json({ user: result.user });
  } catch (err) {
    return mapError(res, err, "Login error:");
  }
}

export async function forgotPasswordHandler(req: AuthRequest, res: Response) {
  try {
    const { normalizedEmail } = parseForgotPasswordBody(req.body);
    await requestPasswordReset(normalizedEmail);

    return res.json({
      message:
        "If an account exists for this email, reset instructions will be sent shortly.",
    });
  } catch (err) {
    return mapError(res, err, "Forgot password error:");
  }
}

export async function refreshHandler(req: AuthRequest, res: Response) {
  const refreshToken = req.cookies?.[COOKIE_NAMES.sellerRefresh];

  if (!refreshToken || typeof refreshToken !== "string") {
    clearSellerAuthCookies(res);
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const rotated = await rotateSellerSession(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (!rotated) {
      clearSellerAuthCookies(res);
      clearCsrfCookie(res);
      return res.status(401).json({ error: "Unauthorized" });
    }

    setSellerAuthCookies(res, rotated.accessToken, rotated.refreshToken);
    issueCsrfCookie(res);

    return res.json({ success: true });
  } catch (err) {
    console.error("Refresh session error:", err);
    clearSellerAuthCookies(res);
    clearCsrfCookie(res);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function logoutHandler(req: AuthRequest, res: Response) {
  const hasSessionCookie = Boolean(
    req.cookies?.[COOKIE_NAMES.sellerAccess] ||
      req.cookies?.[COOKIE_NAMES.sellerRefresh]
  );

  if (
    hasSessionCookie &&
    !isSafeMethod(req.method) &&
    !validateCsrfForCookieRequest(req)
  ) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  const refreshToken = req.cookies?.[COOKIE_NAMES.sellerRefresh];

  if (typeof refreshToken === "string" && refreshToken.length > 0) {
    await revokeSellerSession(refreshToken);
  }

  clearSellerAuthCookies(res);
  clearCsrfCookie(res);

  return res.json({ message: "Logged out" });
}

export async function meHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await getUserById(userId);
    return res.json({ user });
  } catch (err) {
    return mapError(res, err, "Me error:");
  }
}

export async function updateMeHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { trimmedName } = parseUpdateMeBody(req.body);
    const user = await updateUserName(userId, trimmedName);
    return res.json({ user });
  } catch (err) {
    return mapError(res, err, "Update profile error:");
  }
}
