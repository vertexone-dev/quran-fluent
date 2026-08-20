-- Makes ayahs.translation_en / translation_fr nullable. Approved in
-- principle, but recommended to hold applying this until the application
-- compatibility patch (see chat: scheduleReview()'s NOT NULL review_items.
-- back regression) is reviewed and applied — see the accompanying audit.
-- This schema change alone is safe in isolation (the 58 existing rows keep
-- their non-null values; nothing reads a null translation until the full
-- Arabic import actually inserts ayahs without one), but applying it ahead
-- of the code fix sets up a live break the moment the full import lands.
--
-- Additive/widening only: relaxes a constraint, touches no existing value.

ALTER TABLE public.ayahs ALTER COLUMN translation_en DROP NOT NULL;
ALTER TABLE public.ayahs ALTER COLUMN translation_fr DROP NOT NULL;
