const allowedOrigins = new Set([
  "https://bnos-melochim-portal.onrender.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowedOrigin = allowedOrigins.has(origin) ? origin : "https://bnos-melochim-portal.onrender.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || allowedOrigins.has(origin);
}
