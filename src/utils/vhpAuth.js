import axios from "axios";
import "dotenv/config";

const BASE     = process.env.VHP_BASE_URL;
const USERNAME = process.env.VHP_USERNAME;
const PASSWORD = process.env.VHP_PASSWORD;

// ── In-memory session cache ───────────────────────────────────
let _session = {
  token:     null,
  expiresAt: null,   // JS Date
};

/**
 * Returns a valid sessionToken, refreshing if expired or missing.
 * VHP session tokens are valid for 24 hours.
 */
export async function getSessionToken() {
  const now = new Date();

  // Reuse if still valid (with 5-min safety buffer)
  if (_session.token && _session.expiresAt && _session.expiresAt > new Date(now.getTime() + 5 * 60_000)) {
    return _session.token;
  }

  // Request a fresh session
  const url = `${BASE}/authentication`;
  const { data } = await axios.post(
    url,
    { request: { username: USERNAME, password: PASSWORD } },
    { headers: { "Content-Type": "application/json" }, timeout: 15_000 }
  );

  const payload = data?.response ?? data;
  const token   = payload?.sessionToken;
  if (!token) {
    throw new Error(`VHP Authentication failed: ${payload?.messageResult ?? JSON.stringify(data)}`);
  }

  // sessionExpiredAt format: "dd-mm-yyyy hh:mm:ss"
  const raw = payload?.sessionExpiredAt ?? "";
  let expiresAt = new Date(now.getTime() + 24 * 60 * 60_000); // fallback: +24 h
  if (raw) {
    const [datePart, timePart] = raw.split(" ");
    if (datePart && timePart) {
      const [dd, mm, yyyy] = datePart.split("-");
      expiresAt = new Date(`${yyyy}-${mm}-${dd}T${timePart}`);
    }
  }

  _session = { token, expiresAt };
  console.log(`[vhpAuth] New session acquired, expires ${expiresAt.toISOString()}`);
  return token;
}

/** Force-clear the cached session (e.g. after a 401 / expired response). */
export function invalidateSession() {
  _session = { token: null, expiresAt: null };
}