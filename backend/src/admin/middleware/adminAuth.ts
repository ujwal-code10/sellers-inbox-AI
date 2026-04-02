import jwt from "jsonwebtoken";
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

  if (!header) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Malformed authorization header" });
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
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
