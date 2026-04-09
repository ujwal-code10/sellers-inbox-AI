import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import {
  DeliverySchemaError,
  parseCreateDeliveryZoneBody,
  parseUpdateDeliveryZoneBody,
} from "../schemas/deliverySchemas.js";
import {
  createDeliveryZone,
  deleteDeliveryZone,
  DeliveryServiceError,
  listDeliveryZones,
  updateDeliveryZone,
} from "../services/deliveryService.js";

function getAuthedUserId(req: AuthRequest): number | null {
  return typeof req.userId === "number" ? req.userId : null;
}

function requireSingleParam(
  value: string | string[] | undefined,
  fieldName: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DeliverySchemaError(`${fieldName} is required`);
  }

  return value;
}

function handleError(res: Response, err: unknown, logPrefix: string) {
  if (err instanceof DeliverySchemaError || err instanceof DeliveryServiceError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(logPrefix, err);
  return res.status(500).json({ error: "Server error" });
}

export async function createDeliveryZoneHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const input = parseCreateDeliveryZoneBody(req.body);
    const zone = await createDeliveryZone(userId, input);
    return res.status(201).json(zone);
  } catch (err) {
    return handleError(res, err, "Create delivery zone error:");
  }
}

export async function listDeliveryZonesHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const zones = await listDeliveryZones(userId);
    return res.json(zones);
  } catch (err) {
    return handleError(res, err, "List delivery zones error:");
  }
}

export async function updateDeliveryZoneHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const zoneId = requireSingleParam(req.params.id, "Delivery zone id");
    const input = parseUpdateDeliveryZoneBody(req.body);
    const zone = await updateDeliveryZone(userId, zoneId, input);
    return res.json(zone);
  } catch (err) {
    return handleError(res, err, "Update delivery zone error:");
  }
}

export async function deleteDeliveryZoneHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const zoneId = requireSingleParam(req.params.id, "Delivery zone id");
    const result = await deleteDeliveryZone(userId, zoneId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err, "Delete delivery zone error:");
  }
}
