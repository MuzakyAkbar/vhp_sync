import axios from "axios";
import { getSessionToken, invalidateSession } from "../utils/vhpAuth.js";
import "dotenv/config";

const BASE     = process.env.VHP_BASE_URL;
const USERNAME = process.env.VHP_USERNAME;

// ── Build request body ────────────────────────────────────────
async function buildBody(extra = {}) {
  const sessionToken = await getSessionToken();
  return {
    request: {
      username:     USERNAME,
      sessionToken,
      ...extra,
    },
  };
}

/**
 * POST to a VHP RMS report endpoint.
 * Automatically retries once if VHP returns an expired-session error.
 */
async function post(endpoint, bodyExtra = {}, retry = true) {
  const url  = `${BASE}/rms/report/${endpoint}`;
  const body = await buildBody(bodyExtra);

  const { data } = await axios.post(url, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 30_000,
  });

  // Check for session-expired signal in response
  const payload = data?.response ?? data;
  const authResult = payload?.authenticationResult ?? "";
  if (
    retry &&
    (String(payload?.sessionOkFlag) === "false" ||
      authResult.toLowerCase().includes("expired") ||
      authResult.toLowerCase().includes("rejected"))
  ) {
    console.warn("[vhpClient] Session expired, re-authenticating…");
    invalidateSession();
    return post(endpoint, bodyExtra, false); // one retry
  }

  return data;
}

// ── Public API methods ────────────────────────────────────────

export async function fetchReservationByArrivalDate(fromDate, toDate) {
  return post("ReservationByArrivalDate", { fromDate, toDate });
}

export async function fetchReservationByCreationDate(fromDate, toDate) {
  return post("ReservationByCreationDate", { fromDate, toDate });
}

export async function fetchInhouseGuestList() {
  return post("TodayInhouseGuestList");
}

export async function fetchCancelledReservation(fromDate, toDate) {
  return post("ReservationCancelled", { fromDate, toDate });
}

export async function fetchFOTurnoverReport(fromDate, toDate) {
  return post("FOTurnoverReport", { fromDate, toDate });
}