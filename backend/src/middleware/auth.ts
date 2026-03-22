import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: number;
}

export default function auth(
  req: AuthRequest,
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Validate token payload structure
    if (!decoded.id || typeof decoded.id !== 'number' || decoded.id <= 0) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

