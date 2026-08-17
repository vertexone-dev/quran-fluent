CREATE TYPE public.review_item_status AS ENUM ('new','learning','review','relearning','suspended');
CREATE TYPE public.weak_area_source AS ENUM ('placement','practice','self_assessed');

CREATE TABLE public.review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('letter','word','concept','ayah','root')),
  item_key text NOT NULL,
  front text NOT NULL,
  back text NOT NULL,
  context text,
  step_key text,
  status public.review_item_status NOT NULL DEFAULT 'new',
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  interval_days integer NOT NULL DEFAULT 0,
  ease_factor real NOT NULL DEFAULT 2.5,
  repetitions integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
CREATE INDEX review_items_user_due_idx ON public.review_items (user_id, due_date, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_items TO authenticated;
GRANT ALL ON public.review_items TO service_role;
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY review_items_own ON public.review_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER review_items_updated_at BEFORE UPDATE ON public.review_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.weak_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area text NOT NULL,
  source public.weak_area_source NOT NULL DEFAULT 'practice',
  strength integer NOT NULL DEFAULT 0 CHECK (strength >= 0 AND strength <= 100),
  last_practiced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, area, source)
);
CREATE INDEX weak_areas_user_idx ON public.weak_areas (user_id, strength);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weak_areas TO authenticated;
GRANT ALL ON public.weak_areas TO service_role;
ALTER TABLE public.weak_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY weak_areas_own ON public.weak_areas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER weak_areas_updated_at BEFORE UPDATE ON public.weak_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.review_items(id) ON DELETE SET NULL,
  item_type text NOT NULL,
  item_key text NOT NULL,
  correct boolean NOT NULL,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX practice_attempts_user_item_idx ON public.practice_attempts (user_id, item_key, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_attempts TO authenticated;
GRANT ALL ON public.practice_attempts TO service_role;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_attempts_own ON public.practice_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
