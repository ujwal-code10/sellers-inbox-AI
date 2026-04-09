const IS_PRODUCTION =
  Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

const originalConsole = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
};

let isConsoleSafetyInstalled = false;

function sanitizeError(value: unknown): unknown {
  if (value instanceof Error) {
    const errorRecord = value as Error & {
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };

    const payload: Record<string, unknown> = {
      name: errorRecord.name,
      message: errorRecord.message,
    };

    if (errorRecord.code !== undefined) {
      payload.code = String(errorRecord.code);
    }
    if (typeof errorRecord.status === "number") {
      payload.status = errorRecord.status;
    }
    if (typeof errorRecord.statusCode === "number") {
      payload.statusCode = errorRecord.statusCode;
    }

    return payload;
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    for (const key of ["name", "message", "code", "status", "statusCode", "requestId"]) {
      const candidate = source[key];
      if (
        typeof candidate === "string" ||
        typeof candidate === "number" ||
        typeof candidate === "boolean"
      ) {
        payload[key] = candidate;
      }
    }

    if (Object.keys(payload).length > 0) {
      return payload;
    }

    return "[redacted-object]";
  }

  if (typeof value === "undefined") {
    return null;
  }

  return value;
}

function writeSafeConsole(
  level: "error" | "warn",
  args: unknown[]
): void {
  if (!IS_PRODUCTION) {
    originalConsole[level](...args);
    return;
  }

  const sanitizedArgs = args.map((arg) => sanitizeError(arg));
  const firstArg = sanitizedArgs[0];

  const message = typeof firstArg === "string" ? firstArg : "Application log";
  const details =
    typeof firstArg === "string" ? sanitizedArgs.slice(1) : sanitizedArgs;

  const payload: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    message,
  };

  if (details.length === 1) {
    payload.details = details[0];
  } else if (details.length > 1) {
    payload.details = details;
  }

  originalConsole[level](JSON.stringify(payload));
}

export function installProductionConsoleSafety(): void {
  if (!IS_PRODUCTION || isConsoleSafetyInstalled) {
    return;
  }

  isConsoleSafetyInstalled = true;

  console.error = (...args: unknown[]) => {
    writeSafeConsole("error", args);
  };

  console.warn = (...args: unknown[]) => {
    writeSafeConsole("warn", args);
  };

  console.debug = () => {
    // Drop debug-level console output in production.
  };
}