import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

import apiRouter from "./routes/api.js";
import { getDateRange } from "./utils/dateHelper.js";
import { syncAll } from "./services/syncService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3000;

const app = express();
app.use(cors());
app.use(express.json());

// ── Static dashboard ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ── API routes ────────────────────────────────────────────────
app.use("/api", apiRouter);

// ── Health check ──────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Cron: scheduled sync ──────────────────────────────────────
const CRON = process.env.SYNC_CRON ?? "0 1 * * *";

cron.schedule(CRON, async () => {
  // Langsung panggil tanpa argumen, otomatis mulai dari 01 Januari 2026
  const { fromDate, toDate } = getDateRange();
  console.log(`[CRON] Starting scheduled sync  ${fromDate} → ${toDate}`);
  try {
    const results = await syncAll(fromDate, toDate);
    console.log("[CRON] Done:", results);
  } catch (err) {
    console.error("[CRON] Error:", err.message);
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`VHP Sync Service running on http://localhost:${PORT}`);
  console.log(`Dashboard  → http://localhost:${PORT}/`);
  console.log(`API        → http://localhost:${PORT}/api`);
  console.log(`Cron schedule: ${CRON}`);
});