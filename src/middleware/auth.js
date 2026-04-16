import "dotenv/config";

/**
 * Simple Bearer token guard for the management endpoints.
 * Set API_SECRET in .env; pass it as "Authorization: Bearer <secret>"
 * If API_SECRET is not set, all requests are allowed (dev mode).
 */
export function requireAuth(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) return next(); // no secret configured → open

  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}