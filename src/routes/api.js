import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDateRange } from "../utils/dateHelper.js";
import { supabase } from "../utils/supabaseClient.js";
import {
  syncAll,
  syncReservationByArrivalDate,
  syncReservationByCreationDate,
  syncInhouseGuestList,
  syncCancelledReservation,
  syncFOTurnoverReport,
} from "../services/syncService.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────
function parseDates(query) {
  if (query.fromDate && query.toDate) {
    return { fromDate: query.fromDate, toDate: query.toDate };
  }
  // Default tembak ke 01 Januari 2026
  return getDateRange();
}

// ── POST /api/sync  – run all reports ─────────────────────────
router.post("/sync", requireAuth, async (req, res) => {
  const { fromDate, toDate } = parseDates(req.query);
  try {
    const results = await syncAll(fromDate, toDate);
    res.json({ fromDate, toDate, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sync/:report  – run a single report ─────────────
router.post("/sync/:report", requireAuth, async (req, res) => {
  const { fromDate, toDate } = parseDates(req.query);
  const { report } = req.params;

  const map = {
    "arrival-date":    () => syncReservationByArrivalDate(fromDate, toDate),
    "creation-date":   () => syncReservationByCreationDate(fromDate, toDate),
    "inhouse":         () => syncInhouseGuestList(),
    "cancelled":       () => syncCancelledReservation(fromDate, toDate),
    "fo-turnover":     () => syncFOTurnoverReport(fromDate, toDate),
  };

  if (!map[report]) {
    return res.status(404).json({ error: `Unknown report: ${report}` });
  }

  try {
    const result = await map[report]();
    res.json({ fromDate, toDate, ...result, status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/logs  – recent sync logs ─────────────────────────
router.get("/logs", requireAuth, async (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  const { data, error } = await supabase
    .from("acb_sync_log")
    .select("*")
    .order("synced_at", { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/status  – summary counts ─────────────────────────
router.get("/status", async (req, res) => {
  const tables = [
    "acb_future_booking",
    "acb_reservation_list",
    "acb_today_inhouse_list",
    "acb_rsv_cancelled_list",
    "acb_turnover_list",
    "acb_sync_log",
  ];

  const counts = await Promise.all(
    tables.map(async (t) => {
      const { count, error } = await supabase
        .from(t)
        .select("*", { count: "exact", head: true });
      return { table: t, count: error ? null : count };
    })
  );

  const { data: lastLog } = await supabase
    .from("acb_sync_log")
    .select("synced_at, status, report_type")
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();

  res.json({ tables: counts, lastSync: lastLog ?? null });
});

export default router;