import jwt from "jsonwebtoken";
import {
  COOKIE_NAMES,
  isSafeMethod,
  validateCsrfForCookieRequest,
} from "../../utils/authSession.js";
import { Request, Response, NextFunction } from "express";

export interface AdminRequest extends Request {
  adminId?: number;
  adminRole?: "admin" | "super_admin";
}

export function adminAuth(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
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
    const cookieToken = req.cookies?.[COOKIE_NAMES.adminAccess];
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
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      console.error("ADMIN_JWT_SECRET not configured");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const decoded = jwt.verify(token, secret) as {
      id: number;
      role: string;
      type: string;
    };

    if (decoded.type !== "admin") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    if (!decoded.id || typeof decoded.id !== "number" || decoded.id <= 0) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.adminId = decoded.id;
    req.adminRole = decoded.role as "admin" | "super_admin";
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction
) {
  if (req.adminRole !== "super_admin") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
}
