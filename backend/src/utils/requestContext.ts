import { Request } from "express";

export type RequestWithId = Request & { requestId?: string };

export function getRequestId(req: Request): string | undefined {
  const requestId = (req as RequestWithId).requestId;
  if (typeof requestId !== "string" || requestId.trim().length === 0) {
    return undefined;
  }

  return requestId;
}
