import pool from "../../utils/db.js";

interface AuditLogParams {
  adminId: number;
  action: string;
  entityType: string;
  entityId?: number;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string | string[];
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  const {
    adminId,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress,
    userAgent,
  } = params;

  // Normalize userAgent to string
  const userAgentStr = Array.isArray(userAgent) ? userAgent[0] : userAgent;

  try {
    await pool.query(
      `INSERT INTO audit_logs
       (admin_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        adminId,
        action,
        entityType,
        entityId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress || null,
        userAgentStr || null,
      ]
    );
  } catch (err) {
    console.error("Failed to create audit log:", err);
    // Don't throw - audit logging should not break the main operation
  }
}

export async function getAuditLogs(filters: {
  adminId?: number;
  action?: string;
  entityType?: string;
  entityId?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const {
    adminId,
    action,
    entityType,
    entityId,
    from,
    to,
    page = 1,
    limit = 20,
  } = filters;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (adminId) {
    conditions.push(`al.admin_id = $${paramIndex++}`);
    values.push(adminId);
  }
  if (action) {
    conditions.push(`al.action = $${paramIndex++}`);
    values.push(action);
  }
  if (entityType) {
    conditions.push(`al.entity_type = $${paramIndex++}`);
    values.push(entityType);
  }
  if (entityId) {
    conditions.push(`al.entity_id = $${paramIndex++}`);
    values.push(entityId);
  }
  if (from) {
    conditions.push(`al.created_at >= $${paramIndex++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`al.created_at <= $${paramIndex++}`);
    values.push(to);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);
  const result = await pool.query(
    `SELECT al.*, au.name as admin_name, au.email as admin_email
     FROM audit_logs al
     LEFT JOIN admin_users au ON al.admin_id = au.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
