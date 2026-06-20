import jwt from "jsonwebtoken";
import {
  COOKIE_NAMES,
  isSafeMethod,
  validateCsrfForCookieRequest,
} from "../utils/authSession.js";
import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: number;
}

export default function auth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // SOURCE: session token can arrive via legacy Authorization header or primary HttpOnly cookie.
  // RISK: trusting cookie auth on unsafe methods without CSRF check enables cross-site request abuse.
  // PROTECTION: detect token source and enforce CSRF validation for cookie-based unsafe methods.
  // RESULT: backward compatibility remains while preserving cookie-session security guarantees.
  const header = req.headers.authorization;

  let tokenSource: "header" | "cookie" | null = null;
  let token: string | null = null;

  if (header && header.startsWith("Bearer ")) {
    const parsedHeaderToken = header.split(" ")[1];
    if (parsedHeaderToken) {
      token = parsedHeaderToken;
      tokenSource = "header";
    }
  }

  if (!token) {
    const cookieToken = req.cookies?.[COOKIE_NAMES.sellerAccess];
    if (typeof cookieToken === "string" && cookieToken.length > 0) {
      token = cookieToken;
      tokenSource = "cookie";
    }
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  if (
    tokenSource === "cookie" &&
    !isSafeMethod(req.method) &&
    !validateCsrfForCookieRequest(req)
  ) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Validate token payload structure
    if (!decoded.id || typeof decoded.id !== 'number' || decoded.id <= 0) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    if (decoded.type && decoded.type !== "user") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

