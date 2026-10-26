-- Run in Supabase SQL Editor as a project administrator.
-- Adds cloud storage for user settings and recitation notes, then replaces
-- permissive/legacy policies with authenticated, per-user policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.adhithan_checkins (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id      UUID NOT NULL REFERENCES public.adhithan_trackers(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (goal_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS adhithan_checkins_user_date_idx
  ON public.adhithan_checkins (user_id, checkin_date DESC);

CREATE TABLE IF NOT EXISTS public.recitation_notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 12000),
  category   TEXT CHECK (category IS NULL OR char_length(category) <= 64),
  comments   JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(comments) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recitation_notes_user_updated_idx
  ON public.recitation_notes (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bead_target            INTEGER NOT NULL DEFAULT 108 CHECK (bead_target BETWEEN 1 AND 100000),
  meditation_target      INTEGER NOT NULL DEFAULT 30 CHECK (meditation_target BETWEEN 1 AND 1440),
  daily_meditation_goal  INTEGER NOT NULL DEFAULT 15 CHECK (daily_meditation_goal BETWEEN 1 AND 1440),
  sound_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  theme                  TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language               TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'my')),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remove every existing policy on app-owned tables before installing the
-- restrictive policy set. PostgreSQL combines permissive policies with OR.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'beads_records', 'meditation_records', 'adhithan_trackers',
        'adhithan_checkins', 'recitation_notes', 'user_settings'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.beads_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meditation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhithan_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhithan_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recitation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Do not expose application rows to anonymous requests. Authenticated users
-- receive only the SQL privileges required by the app; RLS limits rows.
REVOKE ALL ON TABLE public.beads_records, public.meditation_records,
  public.adhithan_trackers, public.adhithan_checkins,
  public.recitation_notes, public.user_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.beads_records, public.meditation_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.adhithan_trackers TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.adhithan_checkins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recitation_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_settings TO authenticated;

CREATE POLICY beads_select_own ON public.beads_records
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY beads_insert_own ON public.beads_records
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY beads_delete_own ON public.beads_records
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY meditation_select_own ON public.meditation_records
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY meditation_insert_own ON public.meditation_records
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY meditation_delete_own ON public.meditation_records
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY adhithan_select_own ON public.adhithan_trackers
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY adhithan_insert_own ON public.adhithan_trackers
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY adhithan_update_own ON public.adhithan_trackers
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY adhithan_delete_own ON public.adhithan_trackers
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY checkins_select_own ON public.adhithan_checkins
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY checkins_insert_own_goal ON public.adhithan_checkins
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.adhithan_trackers AS goal
      WHERE goal.id = goal_id AND goal.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY checkins_delete_own ON public.adhithan_checkins
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY recitation_notes_select_own ON public.recitation_notes
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY recitation_notes_insert_own ON public.recitation_notes
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recitation_notes_update_own ON public.recitation_notes
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY recitation_notes_delete_own ON public.recitation_notes
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY user_settings_insert_own ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

NOTIFY pgrst, 'reload schema';
