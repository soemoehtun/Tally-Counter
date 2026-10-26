-- ============================================================
--  Dhamma Tracker — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  Then run supabase_security_and_cloud_data_migration.sql for strict per-user
--  RLS and cloud storage tables for settings and recitation notes.
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. Beads Records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beads_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count       INTEGER NOT NULL CHECK (count >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE beads_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own beads records"
  ON beads_records
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Meditation Records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meditation_records (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_minutes   INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE meditation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own meditation records"
  ON meditation_records
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Adhithan Trackers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adhithan_trackers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  total_days      INTEGER NOT NULL CHECK (total_days > 0),
  completed_days  INTEGER NOT NULL DEFAULT 0 CHECK (completed_days >= 0),
  status          TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE adhithan_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own adhithan trackers"
  ON adhithan_trackers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Record each goal check-in so the Adhithan calendar can show practice dates.
CREATE TABLE IF NOT EXISTS adhithan_checkins (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id      UUID NOT NULL REFERENCES adhithan_trackers(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (goal_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS adhithan_checkins_user_date_idx
  ON adhithan_checkins (user_id, checkin_date DESC);

ALTER TABLE adhithan_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own adhithan checkins" ON adhithan_checkins;
CREATE POLICY "Users can manage their own adhithan checkins"
  ON adhithan_checkins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
