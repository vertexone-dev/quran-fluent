CREATE TYPE public.word_category AS ENUM ('noun', 'verb', 'particle', 'phrase');

CREATE TABLE public.word_frequency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  transliteration TEXT,
  meaning TEXT NOT NULL,
  meaning_fr TEXT,
  frequency_rank INTEGER,
  occurrences INTEGER,
  root TEXT,
  example_ayah TEXT,
  example_reference TEXT,
  topic_tags TEXT[],
  category public.word_category,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT ON public.word_frequency TO authenticated;
GRANT ALL ON public.word_frequency TO service_role;

ALTER TABLE public.word_frequency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read word frequency"
ON public.word_frequency
FOR SELECT TO authenticated
USING (true);

CREATE TABLE public.user_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.word_frequency(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('new', 'learning', 'known', 'mastered')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, word_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vocabulary TO authenticated;
GRANT ALL ON public.user_vocabulary TO service_role;

ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vocabulary"
ON public.user_vocabulary
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_vocabulary_updated_at
BEFORE UPDATE ON public.user_vocabulary
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.word_frequency (word, transliteration, meaning, meaning_fr, frequency_rank, occurrences, root, example_ayah, example_reference, topic_tags, category) VALUES
('اللَّه', 'Allāh', 'Allah', 'Allah', 1, 2800, 'أ-ل-ه', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', '1:1', '{divinity}', 'noun'),
('الرَّحْمَٰن', 'Ar-Raḥmān', 'The Most Gracious', 'Le Tout Miséricordieux', 2, 57, 'ر-ح-م', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', '1:1', '{divinity, mercy}', 'noun'),
('الرَّحِيم', 'Ar-Raḥīm', 'The Most Merciful', 'Le Très Miséricordieux', 3, 123, 'ر-ح-م', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', '1:1', '{divinity, mercy}', 'noun'),
('رَبّ', 'Rabb', 'Lord and Sustainer', 'Seigneur et Nourricier', 4, 980, 'ر-ب-ب', 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', '1:2', '{divinity}', 'noun'),
('عَالَمِين', 'ʿĀlamīn', 'Worlds, all creation', 'Mondes, toute la création', 5, 73, 'ع-ل-م', 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', '1:2', '{creation}', 'noun'),
('مَالِك', 'Mālik', 'Master, Owner', 'Maître, Souverain', 6, 21, 'م-ل-ك', 'مَالِكِ يَوْمِ الدِّينِ', '1:4', '{divinity}', 'noun'),
('يَوْم', 'Yawm', 'Day', 'Jour', 7, 450, 'ي-و-م', 'مَالِكِ يَوْمِ الدِّينِ', '1:4', '{time}', 'noun'),
('دِّين', 'Dīn', 'Judgment, recompense', 'Jugement, rétribution', 8, 92, 'د-ي-ن', 'مَالِكِ يَوْمِ الدِّينِ', '1:4', '{judgment}', 'noun'),
('صِرَاط', 'Ṣirāṭ', 'Path, way', 'Chemin, voie', 9, 45, 'ص-ر-ط', 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', '1:6', '{guidance}', 'noun'),
('مُسْتَقِيم', 'Mustaqīm', 'Straight, upright', 'Droit, rectiligne', 10, 34, 'ق-و-م', 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', '1:6', '{guidance}', 'noun');