import pool from "./db.js";

export interface FreeTierLimits {
  dailyReplies: number;
  maxProducts: number;
  enforced: boolean;
  source: "system_settings" | "fallback";
}

const TRUST_STAGE_DEFAULTS = {
  dailyReplies: 99,
  maxProducts: 99,
};

const ENFORCED_FALLBACK = {
  dailyReplies: 3,
  maxProducts: 5,
};

const CACHE_TTL_MS = 60_000;

let cache: { expiresAt: number; value: FreeTierLimits } | null = null;

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function parseSettingsValue(rawValue: unknown): FreeTierLimits {
  const raw =
    rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? (rawValue as Record<string, unknown>)
      : {};

  const modeFromField =
    typeof raw.mode === "string" ? raw.mode.trim().toLowerCase() : "";
  const modeFromFlag =
    toBoolean(raw.enforce) ?? toBoolean(raw.enforced) ?? null;

  const enforced =
    modeFromFlag ??
    (modeFromField === "enforced"
      ? true
      : modeFromField === "trust"
        ? false
        : false);

  if (!enforced) {
    return {
      dailyReplies: TRUST_STAGE_DEFAULTS.dailyReplies,
      maxProducts: TRUST_STAGE_DEFAULTS.maxProducts,
      enforced: false,
      source: "system_settings",
    };
  }

  const configuredDaily = toPositiveInteger(raw.daily_replies);
  const configuredProducts = toPositiveInteger(raw.max_products);

  return {
    dailyReplies: configuredDaily ?? ENFORCED_FALLBACK.dailyReplies,
    maxProducts: configuredProducts ?? ENFORCED_FALLBACK.maxProducts,
    enforced: true,
    source: "system_settings",
  };
}

async function loadFreeTierLimitsFromDb(): Promise<FreeTierLimits | null> {
  const result = await pool.query(
    `SELECT value FROM system_settings WHERE key = 'free_tier_limits' LIMIT 1`
  );

  if (result.rows.length === 0) {
    return null;
  }

  return parseSettingsValue(result.rows[0].value);
}

function fallbackLimits(): FreeTierLimits {
  return {
    dailyReplies: TRUST_STAGE_DEFAULTS.dailyReplies,
    maxProducts: TRUST_STAGE_DEFAULTS.maxProducts,
    enforced: false,
    source: "fallback",
  };
}

export async function getEffectiveFreeTierLimits(options?: {
  forceRefresh?: boolean;
}): Promise<FreeTierLimits> {
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && cache && Date.now() < cache.expiresAt) {
    return cache.value;
  }

  try {
    const limits = (await loadFreeTierLimitsFromDb()) ?? fallbackLimits();
    cache = {
      value: limits,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return limits;
  } catch (err) {
    console.error("Failed to load free tier limits from settings:", err);

    if (cache) {
      return cache.value;
    }

    return fallbackLimits();
  }
}
