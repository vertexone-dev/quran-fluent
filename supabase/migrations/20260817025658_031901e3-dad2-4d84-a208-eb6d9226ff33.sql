CREATE TYPE public.placement_level AS ENUM ('complete_beginner','foundation','beginner_reader','developing_reader','intermediate_quranic');
CREATE TYPE public.path_step_status AS ENUM ('locked','available','in_progress','completed');

CREATE TABLE public.placement_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  section_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_level public.placement_level NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX placement_attempts_user_idx ON public.placement_attempts (user_id, completed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.placement_attempts TO authenticated;
GRANT ALL ON public.placement_attempts TO service_role;
ALTER TABLE public.placement_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY placement_attempts_own ON public.placement_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  level public.placement_level NOT NULL,
  source text NOT NULL DEFAULT 'onboarding',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_paths TO authenticated;
GRANT ALL ON public.learning_paths TO service_role;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_paths_own ON public.learning_paths FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER learning_paths_updated_at BEFORE UPDATE ON public.learning_paths FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.learning_path_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  order_index integer NOT NULL,
  status public.path_step_status NOT NULL DEFAULT 'locked',
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_id, step_key)
);
CREATE INDEX learning_path_steps_path_idx ON public.learning_path_steps (path_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_path_steps TO authenticated;
GRANT ALL ON public.learning_path_steps TO service_role;
ALTER TABLE public.learning_path_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_path_steps_own ON public.learning_path_steps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER learning_path_steps_updated_at BEFORE UPDATE ON public.learning_path_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();