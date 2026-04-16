import { supabase } from "../utils/supabaseClient.js";
import { parseDate } from "../utils/dateHelper.js";
import {
  fetchReservationByArrivalDate,
  fetchReservationByCreationDate,
  fetchInhouseGuestList,
  fetchCancelledReservation,
  fetchFOTurnoverReport,
} from "./vhpClient.js";

// ── Helper: write a sync log entry ───────────────────────────
async function writeLog(reportType, fromDate, toDate, rowsUpserted, status, errorMessage = null) {
  await supabase.from("acb_sync_log").insert({
    report_type:   reportType,
    from_date:     fromDate || null,
    to_date:       toDate   || null,
    rows_upserted: rowsUpserted,
    status,
    error_message: errorMessage,
  });
}

// ── Helper: safe upsert ───────────────────────────────────────
async function upsertRows(table, rows, conflictColumns) {
  if (!rows?.length) return 0;
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictColumns, ignoreDuplicates: false });
  if (error) throw new Error(`Supabase upsert error [${table}]: ${error.message}`);
  return rows.length;
}

// ── Sanitize text: remove invalid unicode escapes & control chars ──
// VHP remark fields often contain raw HTML, \r, and malformed unicode
// sequences like \u0000 which Supabase / Postgres rejects.
function sanitizeText(v) {
  if (v == null) return null;
  return String(v)
    // Remove null bytes and other non-printable control chars (except \t \n \r)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Normalise lone \r → \n
    .replace(/\r\n?/g, "\n")
    // Strip literal backslash-u sequences that aren't valid JSON escapes
    // e.g. \uXXXX where XXXX is not hex (this appears in VHP remark HTML)
    .replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u")
    .trim() || null;
}

// ── Strip thousand-separator commas before parsing ────────────
function parseNum(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────
// Extract the data array from VHP v3 response
//
// Real v3 responses observed:
//   { response: { reservationList: { "reservation-list": [...] } } }
//   { response: { rsvCancelledList: { "rsv-cancelled-list": [...] } } }
//   { response: { futureBooking: { "future-booking": [...] } } }
//   { response: { todayInhouseList: { "today-inhouse-list": [...] } } }
//   { response: { turnoverList: { "turnover-list": [...] } } }
//
// The outer key is camelCase; inside is a kebab-case array.
// ─────────────────────────────────────────────────────────────
function extractList(response, kebabKey) {
  const payload = response?.response ?? response;
  if (!payload) return [];

  const camelMap = {
    "future-booking":      "futureBooking",
    "reservation-list":    "reservationList",
    "today-inhouse-list":  "todayInhouseList",
    "rsv-cancelled-list":  "rsvCancelledList",
    "turnover-list":       "turnoverList",
  };

  const camelKey = camelMap[kebabKey];

  for (const k of [camelKey, kebabKey].filter(Boolean)) {
    const val = payload?.[k];
    if (!val) continue;

    if (Array.isArray(val)) return val;

    if (typeof val === "object") {
      for (const inner of Object.values(val)) {
        if (Array.isArray(inner)) return inner;
      }
      // Pastikan val adalah sebuah baris data, bukan objek wrapper kosong
      if (Object.keys(val).some(key => key.includes("-"))) {
        return [val];
      }
    }
  }

  return [];
}

// ─────────────────────────────────────────────────────────────
// Perbaikan syncReservationByCreationDate dengan Debug Log
// ─────────────────────────────────────────────────────────────
export async function syncReservationByCreationDate(fromDate, toDate) {
  const type = "reservation_list";
  try {
    const res  = await fetchReservationByCreationDate(fromDate, toDate);

    // ── DEBUG LOGGING PENTING ──
    const payload = res?.response ?? res;
    console.log(`\n[DEBUG] API VHP Hit: ${fromDate} - ${toDate}`);
    console.log(`[DEBUG] Result Message VHP: "${payload?.resultMessage}"`);
    // ───────────────────────────

    const rows = extractList(res, "reservation-list").map(mapReservationRow);
    const n    = await upsertRows("acb_reservation_list", rows, "rsv_number,rsv_line_number");
    
    // Log jumlah yang berhasil diekstrak
    console.log(`[DEBUG] Berhasil mengekstrak ${rows.length} baris data.`);

    await writeLog(type, fromDate, toDate, n, "success");
    return { type, rows: n };
  } catch (err) {
    await writeLog(type, fromDate, toDate, 0, "error", err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapReservationRow(r) {
  return {
    rsv_number:      Number(r["rsv-number"])      || 0,
    rsv_line_number: Number(r["rsv-line-number"]) || 0,
    rsv_create_date: parseDate(r["rsv-create-date"]),
    rsv_status:      sanitizeText(r["rsv-status"]),
    rsv_name:        sanitizeText(r["rsv-name"]),
    room_number:     sanitizeText(r["room-number"]),
    guest_name:      sanitizeText(r["guest-name"]),
    guest_email:     sanitizeText(r["guest-email"]),
    guest_phone:     sanitizeText(r["guest-phone"]),
    guest_nation:    sanitizeText(r["guest-nation"]),
    checkin_date:    parseDate(r["checkin-date"]),
    checkout_date:   parseDate(r["checkout-date"]),
    room_qty:        Number(r["room-qty"])     || null,
    room_type:       sanitizeText(r["room-type"]),
    arrangement:     sanitizeText(r["arrangement"]),
    room_rate:       parseNum(r["room-rate"]),
    total_night:     Number(r["total-night"]) || null,
    adult:           Number(r["adult"])        || null,
    child:           Number(r["child"])        || null,
    compliment:      Number(r["compliment"])   || null,
    bed_type:        sanitizeText(r["bed-type"]),
    arrival_time:    sanitizeText(r["arrival-time"]),
    depart_time:     sanitizeText(r["depart-time"]),
    updated_at:      new Date().toISOString(),
  };
}

function mapCancelledRow(r) {
  return {
    rsv_number:          Number(r["rsv-number"])      || 0,
    rsv_line_number:     Number(r["rsv-line-number"]) || 0,
    rsv_create_date:     parseDate(r["rsv-create-date"]),
    rsv_create_usr_id:   sanitizeText(r["rsv-create-usr-id"]),
    rsv_name:            sanitizeText(r["rsv-name"]),
    // rsv_remark is the notorious field — strip HTML + control chars
    rsv_remark:          sanitizeText(r["rsv-remark"]),
    rsv_rate_code:       sanitizeText(r["rsv-rate-code"]),
    rsv_segment:         sanitizeText(r["rsv-segment"]),
    rsv_special_request: sanitizeText(r["rsv-special-request"]),
    rsv_groupname:       sanitizeText(r["rsv-groupname"]),
    rsv_gastnr:          parseNum(r["rsv-gastnr"]),
    company_name:        sanitizeText(r["company-name"]),
    checkin_date:        parseDate(r["checkin-date"]),
    checkout_date:       parseDate(r["checkout-date"]),
    room_number:         sanitizeText(r["room-number"]),
    room_qty:            Number(r["room-qty"])     || null,
    room_type:           sanitizeText(r["room-type"]),
    room_rate:           parseNum(r["room-rate"]),
    arrangement:         sanitizeText(r["arrangement"]),
    total_night:         Number(r["total-night"]) || null,
    adult:               Number(r["adult"])        || null,
    child:               Number(r["child"])        || null,
    compliment:          Number(r["compliment"])   || null,
    guest_name:          sanitizeText(r["guest-name"]),
    guest_remark:        sanitizeText(r["guest-remark"]),
    guest_address:       sanitizeText(r["guest-address"]),
    guest_city:          sanitizeText(r["guest-city"]),
    vip:                 sanitizeText(r["vip"]),
    nationality:         sanitizeText(r["nationality"]),
    cancelled_date:      parseDate(r["cancelled-date"]),
    cancelled_id:        sanitizeText(r["cancelled-id"]),
    cancelled_time:      sanitizeText(r["cancelled-time"]),
    cancelled_reason:    sanitizeText(r["cancelled-reason"]),
    updated_at:          new Date().toISOString(),
  };
}

function mapTurnoverRow(r, reportDate) {
  return {
    artikel_number:   parseNum(r["artikel-number"]) ?? 0,
    report_date:      reportDate,
    description_turn: sanitizeText(r["description-turn"]),
    day_nett:         parseNum(r["day-nett"]),
    day_serv:         parseNum(r["day-serv"]),
    day_tax:          parseNum(r["day-tax"]),
    day_gros:         parseNum(r["day-gros"]),
    day_persen:       parseNum(r["day-persen"]),
    mtd_nett:         parseNum(r["mtd-nett"]),
    mtd_serv:         parseNum(r["mtd-serv"]),
    mtd_tax:          parseNum(r["mtd-tax"]),
    mtd_gros:         parseNum(r["mtd-gros"]),
    mtd_persen:       parseNum(r["mtd-persen"]),
    ytd_nett:         parseNum(r["ytd-nett"]),
    ytd_serv:         parseNum(r["ytd-serv"]),
    ytd_tax:          parseNum(r["ytd-tax"]),
    ytd_gros:         parseNum(r["ytd-gros"]),
    ytd_persen:       parseNum(r["ytd-persen"]),
    month_budget:     parseNum(r["month-budget"]),
    updated_at:       new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Individual sync functions
// ─────────────────────────────────────────────────────────────

export async function syncReservationByArrivalDate(fromDate, toDate) {
  const type = "future_booking";
  try {
    const res  = await fetchReservationByArrivalDate(fromDate, toDate);
    const rows = extractList(res, "future-booking").map(mapReservationRow);
    const n    = await upsertRows("acb_future_booking", rows, "rsv_number,rsv_line_number");
    await writeLog(type, fromDate, toDate, n, "success");
    return { type, rows: n };
  } catch (err) {
    await writeLog(type, fromDate, toDate, 0, "error", err.message);
    throw err;
  }
}

export async function syncInhouseGuestList() {
  const type  = "today_inhouse_list";
  const today = new Date().toISOString().split("T")[0];
  try {
    const res  = await fetchInhouseGuestList();
    const rows = extractList(res, "today-inhouse-list").map((r) => ({
      ...mapReservationRow(r),
      snapshot_date: today,
    }));
    const n = await upsertRows(
      "acb_today_inhouse_list",
      rows,
      "rsv_number,rsv_line_number,snapshot_date"
    );
    await writeLog(type, today, today, n, "success");
    return { type, rows: n };
  } catch (err) {
    await writeLog(type, null, null, 0, "error", err.message);
    throw err;
  }
}

export async function syncCancelledReservation(fromDate, toDate) {
  const type = "rsv_cancelled_list";
  try {
    const res  = await fetchCancelledReservation(fromDate, toDate);
    const rows = extractList(res, "rsv-cancelled-list").map(mapCancelledRow);
    const n    = await upsertRows("acb_rsv_cancelled_list", rows, "rsv_number,rsv_line_number");
    await writeLog(type, fromDate, toDate, n, "success");
    return { type, rows: n };
  } catch (err) {
    await writeLog(type, fromDate, toDate, 0, "error", err.message);
    throw err;
  }
}

export async function syncFOTurnoverReport(fromDate, toDate) {
  const type = "turnover_list";
  const reportDate = toDate
    ? parseDate(toDate)
    : new Date().toISOString().split("T")[0];
  try {
    const res  = await fetchFOTurnoverReport(fromDate, toDate);
    const rows = extractList(res, "turnover-list").map((r) => mapTurnoverRow(r, reportDate));
    const n    = await upsertRows("acb_turnover_list", rows, "artikel_number,report_date");
    await writeLog(type, fromDate, toDate, n, "success");
    return { type, rows: n };
  } catch (err) {
    await writeLog(type, fromDate, toDate, 0, "error", err.message);
    throw err;
  }
}

// ── Run all reports for a date range ─────────────────────────
export async function syncAll(fromDate, toDate) {
  const results = await Promise.allSettled([
    syncReservationByArrivalDate(fromDate, toDate),
    syncReservationByCreationDate(fromDate, toDate),
    syncInhouseGuestList(),
    syncCancelledReservation(fromDate, toDate),
    syncFOTurnoverReport(fromDate, toDate),
  ]);

  const labels = [
    "ReservationByArrivalDate",
    "ReservationByCreationDate",
    "InhouseGuestList",
    "CancelledReservation",
    "FOTurnoverReport",
  ];

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? { report: labels[i], ...r.value, status: "success" }
      : { report: labels[i], status: "error", error: r.reason?.message }
  );
}