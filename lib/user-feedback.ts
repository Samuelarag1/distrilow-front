type ErrorWithResponse = {
  message?: unknown;
  details?: unknown;
  response?: {
    data?: {
      message?: unknown;
      details?: unknown;
      error?: unknown;
    };
  };
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === "string" ? normalizeWhitespace(item) : ""))
      .filter(Boolean)
      .join(" ");
    return joined.length > 0 ? joined : null;
  }

  return null;
}

export function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;

  if (typeof error === "string") {
    return getStringValue(error);
  }

  if (error instanceof Error) {
    return getStringValue(error.message);
  }

  if (typeof error === "object") {
    const candidate = error as ErrorWithResponse;
    return (
      getStringValue(candidate.response?.data?.details) ??
      getStringValue(candidate.response?.data?.message) ??
      getStringValue(candidate.response?.data?.error) ??
      getStringValue(candidate.details) ??
      getStringValue(candidate.message)
    );
  }

  return null;
}

function normalizeKnownErrorMessage(message: string, fallback: string) {
  const cleaned = normalizeWhitespace(
    message
      .replace(/^(error|exception)\s*[:\-]\s*/i, "")
      .replace(/^request failed\s*[:\-]\s*/i, "")
  );
  const normalized = cleaned.toLowerCase();

  if (!normalized) return fallback;

  if (
    normalized.includes("not enouth stock") ||
    normalized.includes("not enough stock") ||
    normalized.includes("insufficient stock")
  ) {
    return "No hay stock suficiente para completar la operacion.";
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network error") ||
    normalized.includes("network request failed")
  ) {
    return "No pudimos conectarnos con el servidor. Verifica tu conexion e intenta nuevamente.";
  }

  if (
    normalized.includes("invalid credentials") ||
    normalized.includes("credenciales invalidas") ||
    normalized.includes("authentication failed")
  ) {
    return "Revisa tu email y tu contrasena, y vuelve a intentarlo.";
  }

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    (normalized.includes("session") && normalized.includes("expired")) ||
    (normalized.includes("token") && normalized.includes("expired"))
  ) {
    return "Tu sesion vencio o no tienes permisos para realizar esta accion.";
  }

  if (
    normalized.includes("missing branch") ||
    (normalized.includes("branch") && normalized.includes("required"))
  ) {
    return "Debes seleccionar una sucursal activa para continuar.";
  }

  if (
    (normalized.includes("cash session") &&
      (normalized.includes("not found") || normalized.includes("required"))) ||
    normalized.includes("no open cash session")
  ) {
    return "No encontramos una caja abierta en esta sucursal.";
  }

  if (normalized.includes("already an open cash session")) {
    return "Ya hay una caja abierta en esta sucursal.";
  }

  if (
    normalized.includes("already exists") ||
    normalized.includes("already in use") ||
    normalized.includes("unique constraint") ||
    normalized.includes("duplicate")
  ) {
    return "Ya existe un registro con esos datos. Revisa la informacion e intenta nuevamente.";
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  ) {
    return "La operacion tardo demasiado en responder. Intenta nuevamente.";
  }

  if (
    cleaned.length > 220 ||
    /\b(sql|query failed|axios|prisma|typeorm|jwt|etag|trace|stack)\b/i.test(
      cleaned
    )
  ) {
    return fallback;
  }

  if (
    /not found|invalid|failed|required|missing|unauthorized|forbidden|expired|timeout/.test(
      normalized
    )
  ) {
    return fallback;
  }

  return cleaned;
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = "No pudimos completar la accion. Intenta nuevamente."
) {
  const rawMessage = extractErrorMessage(error);
  if (!rawMessage) return fallback;
  return normalizeKnownErrorMessage(rawMessage, fallback);
}
