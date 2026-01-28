const DEFAULT_ALLOWED_METHODS = "GET,POST,OPTIONS";
const DEFAULT_ALLOWED_HEADERS = "content-type,x-request-id";

export function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin) {
    return {};
  }

  const allowList = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (allowList.length === 0) {
    return {};
  }

  const isAllowed = allowList.includes("*") || allowList.includes(origin);
  if (!isAllowed) {
    return {};
  }

  return {
    "access-control-allow-origin": allowList.includes("*") ? "*" : origin,
    "access-control-allow-methods": DEFAULT_ALLOWED_METHODS,
    "access-control-allow-headers": DEFAULT_ALLOWED_HEADERS,
    vary: "origin",
  };
}

export function getSecurityHeaders(): HeadersInit {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "geolocation=(), camera=(), microphone=()",
    "cross-origin-resource-policy": "same-site",
  };
}
