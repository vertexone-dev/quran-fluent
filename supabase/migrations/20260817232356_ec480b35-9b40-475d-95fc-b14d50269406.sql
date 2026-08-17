CREATE INDEX IF NOT EXISTS review_items_user_due_idx ON public.review_items (user_id, due_date);
CREATE INDEX IF NOT EXISTS review_items_user_step_idx ON public.review_items (user_id, step_key);
CREATE INDEX IF NOT EXISTS practice_attempts_user_created_idx ON public.practice_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS study_sessions_user_occurred_idx ON public.study_sessions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS weak_areas_user_strength_idx ON public.weak_areas (user_id, strength);
CREATE INDEX IF NOT EXISTS learning_path_steps_user_order_idx ON public.learning_path_steps (user_id, order_index);
CREATE INDEX IF NOT EXISTS user_vocabulary_user_idx ON public.user_vocabulary (user_id);
CREATE INDEX IF NOT EXISTS placement_attempts_user_completed_idx ON public.placement_attempts (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS word_frequency_rank_idx ON public.word_frequency (frequency_rank);