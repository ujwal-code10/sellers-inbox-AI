type MonitoringContext = Record<string, unknown>;

declare global {
  interface Window {
    Sentry?: {
      captureException: (error: Error, context?: { extra?: MonitoringContext }) => void;
    };
  }
}

function toError(message: string, err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }

  return new Error(message);
}

export function captureClientError(
  message: string,
  err: unknown,
  context?: MonitoringContext
): void {
  if (typeof window !== "undefined" && window.Sentry?.captureException) {
    window.Sentry.captureException(toError(message, err), {
      extra: {
        message,
        ...(context || {}),
      },
    });
    return;
  }

  if (import.meta.env.DEV) {
    console.error(message, err, context || {});
  }
}

export {};