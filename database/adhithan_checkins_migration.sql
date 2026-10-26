-- Run this once in Supabase Dashboard → SQL Editor → New Query.
-- It creates the dated check-in history used by the goal buttons and calendar.

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

ALTER TABLE public.adhithan_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own adhithan checkins" ON public.adhithan_checkins;
CREATE POLICY "Users can manage their own adhithan checkins"
  ON public.adhithan_checkins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
