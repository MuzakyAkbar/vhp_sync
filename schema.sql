-- ============================================================
-- VHP Sync Schema – run once in your Supabase SQL editor
-- Table prefix: acb_ (Artotel Cabin Bromo)
-- ============================================================

-- ── Sync log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acb_sync_log (
  id            BIGSERIAL PRIMARY KEY,
  report_type   TEXT        NOT NULL,
  from_date     DATE,
  to_date       DATE,
  rows_upserted INT         DEFAULT 0,
  status        TEXT        NOT NULL,  -- 'success' | 'error'
  error_message TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── a. Reservation By Arrival Date ──────────────────────────
CREATE TABLE IF NOT EXISTS acb_future_booking (
  -- natural PK: reservation + line
  rsv_number       BIGINT      NOT NULL,
  rsv_line_number  INT         NOT NULL,
  -- data
  rsv_create_date  DATE,
  rsv_status       TEXT,
  rsv_name         TEXT,
  room_number      TEXT,
  guest_name       TEXT,
  guest_email      TEXT,
  guest_phone      TEXT,
  guest_nation     TEXT,
  checkin_date     DATE,
  checkout_date    DATE,
  room_qty         INT,
  room_type        TEXT,
  arrangement      TEXT,
  room_rate        NUMERIC(18,2),
  total_night      INT,
  adult            INT,
  child            INT,
  compliment       INT,
  bed_type         TEXT,
  arrival_time     TEXT,
  depart_time      TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (rsv_number, rsv_line_number)
);

-- ── b. Reservation By Creation Date ─────────────────────────
CREATE TABLE IF NOT EXISTS acb_reservation_list (
  rsv_number       BIGINT      NOT NULL,
  rsv_line_number  INT         NOT NULL,
  rsv_create_date  DATE,
  rsv_status       TEXT,
  rsv_name         TEXT,
  room_number      TEXT,
  guest_name       TEXT,
  guest_email      TEXT,
  guest_phone      TEXT,
  guest_nation     TEXT,
  checkin_date     DATE,
  checkout_date    DATE,
  room_qty         INT,
  room_type        TEXT,
  arrangement      TEXT,
  room_rate        NUMERIC(18,2),
  total_night      INT,
  adult            INT,
  child            INT,
  compliment       INT,
  bed_type         TEXT,
  arrival_time     TEXT,
  depart_time      TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (rsv_number, rsv_line_number)
);

-- ── c. Inhouse Guest List ────────────────────────────────────
CREATE TABLE IF NOT EXISTS acb_today_inhouse_list (
  rsv_number       BIGINT      NOT NULL,
  rsv_line_number  INT         NOT NULL,
  rsv_create_date  DATE,
  rsv_status       TEXT,
  rsv_name         TEXT,
  room_number      TEXT,
  guest_name       TEXT,
  guest_email      TEXT,
  guest_phone      TEXT,
  guest_nation     TEXT,
  checkin_date     DATE,
  checkout_date    DATE,
  room_qty         INT,
  room_type        TEXT,
  arrangement      TEXT,
  room_rate        NUMERIC(18,2),
  total_night      INT,
  adult            INT,
  child            INT,
  compliment       INT,
  bed_type         TEXT,
  arrival_time     TEXT,
  depart_time      TEXT,
  snapshot_date    DATE        DEFAULT CURRENT_DATE,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (rsv_number, rsv_line_number, snapshot_date)
);

-- ── d. Cancelled Reservation ─────────────────────────────────
CREATE TABLE IF NOT EXISTS acb_rsv_cancelled_list (
  rsv_number           BIGINT  NOT NULL,
  rsv_line_number      INT     NOT NULL,
  rsv_create_date      DATE,
  rsv_create_usr_id    TEXT,
  rsv_name             TEXT,
  rsv_remark           TEXT,
  rsv_rate_code        TEXT,
  rsv_segment          TEXT,
  rsv_special_request  TEXT,
  rsv_groupname        TEXT,
  rsv_gastnr           BIGINT,
  company_name         TEXT,
  checkin_date         DATE,
  checkout_date        DATE,
  room_number          TEXT,
  room_qty             INT,
  room_type            TEXT,
  room_rate            NUMERIC(18,2),
  arrangement          TEXT,
  total_night          INT,
  adult                INT,
  child                INT,
  compliment           INT,
  guest_name           TEXT,
  guest_remark         TEXT,
  guest_address        TEXT,
  guest_city           TEXT,
  vip                  TEXT,
  nationality          TEXT,
  cancelled_date       DATE,
  cancelled_id         TEXT,
  cancelled_time       TEXT,
  cancelled_reason     TEXT,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (rsv_number, rsv_line_number)
);

-- ── e. FO Turnover Report ─────────────────────────────────────
-- PK: artikel_number + report_date (one row per article per day)
CREATE TABLE IF NOT EXISTS acb_turnover_list (
  artikel_number   INT     NOT NULL,
  report_date      DATE    NOT NULL,
  description_turn TEXT,
  day_nett         NUMERIC(18,2),
  day_serv         NUMERIC(18,2),
  day_tax          NUMERIC(18,2),
  day_gros         NUMERIC(18,2),
  day_persen       NUMERIC(18,4),
  mtd_nett         NUMERIC(18,2),
  mtd_serv         NUMERIC(18,2),
  mtd_tax          NUMERIC(18,2),
  mtd_gros         NUMERIC(18,2),
  mtd_persen       NUMERIC(18,4),
  ytd_nett         NUMERIC(18,2),
  ytd_serv         NUMERIC(18,2),
  ytd_tax          NUMERIC(18,2),
  ytd_gros         NUMERIC(18,2),
  ytd_persen       NUMERIC(18,4),
  month_budget     NUMERIC(18,2),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (artikel_number, report_date)
);

-- ── Indexes for common queries ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_future_booking_checkin   ON acb_future_booking (checkin_date);
CREATE INDEX IF NOT EXISTS idx_reservation_create       ON acb_reservation_list (rsv_create_date);
CREATE INDEX IF NOT EXISTS idx_cancelled_date           ON acb_rsv_cancelled_list (cancelled_date);
CREATE INDEX IF NOT EXISTS idx_turnover_report_date     ON acb_turnover_list (report_date);