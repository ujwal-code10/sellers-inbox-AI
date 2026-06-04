import {
  DeliveryZoneCreateInput,
  DeliveryZoneUpdateInput,
} from "../models/delivery.js";
import {
  deleteDeliveryZoneByUser,
  insertDeliveryZone,
  selectDeliveryZonesByUser,
  updateDeliveryZoneByUser,
} from "../repositories/deliveryRepository.js";

export class DeliveryServiceError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "DeliveryServiceError";
    this.status = status;
  }
}

export async function createDeliveryZone(
  userId: number,
  input: DeliveryZoneCreateInput
) {
  try {
    return await insertDeliveryZone(userId, input);
  } catch {
    throw new DeliveryServiceError("Server error", 500);
  }
}

export async function listDeliveryZones(userId: number) {
  try {
    return await selectDeliveryZonesByUser(userId);
  } catch {
    throw new DeliveryServiceError("Server error", 500);
  }
}

export async function updateDeliveryZone(
  userId: number,
  deliveryZoneId: string,
  input: DeliveryZoneUpdateInput
) {
  try {
    // SOURCE: controller passes authenticated userId and validated zone update fields.
    // RISK: silent no-op updates can mask wrong zone id or cross-user access attempts.
    // PROTECTION: convert empty repository update result into explicit 404 service error.
    // RESULT: callers can distinguish not-found from successful updates.
    const updated = await updateDeliveryZoneByUser(userId, deliveryZoneId, input);

    if (!updated) {
      throw new DeliveryServiceError("Delivery zone not found", 404);
    }

    return updated;
  } catch (err) {
    if (err instanceof DeliveryServiceError) {
      throw err;
    }

    throw new DeliveryServiceError("Server error", 500);
  }
}

export async function deleteDeliveryZone(userId: number, deliveryZoneId: string) {
  try {
    const deleted = await deleteDeliveryZoneByUser(userId, deliveryZoneId);

    if (!deleted) {
      throw new DeliveryServiceError("Delivery zone not found", 404);
    }

    return { message: "Delivery zone deleted" };
  } catch (err) {
    if (err instanceof DeliveryServiceError) {
      throw err;
    }

    throw new DeliveryServiceError("Server error", 500);
  }
}
