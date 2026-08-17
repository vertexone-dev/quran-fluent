GRANT SELECT ON public.word_frequency TO anon;

CREATE POLICY "Anonymous users can read word frequency"
ON public.word_frequency
FOR SELECT TO anon
USING (true);