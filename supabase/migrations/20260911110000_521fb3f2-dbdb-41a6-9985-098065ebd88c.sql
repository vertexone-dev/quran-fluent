-- Remediation for the disputed fr.hamidullah legacy French translation.
--
-- Background: the V1 bootstrap migration (20260818042151) seeded 58 ayahs
-- (7 fully-covered surahs: Al-Fatiha, Al-Mulk, Al-Asr, Al-Kawthar,
-- Al-Ikhlas, Al-Falaq, An-Nas) with French text from the "fr.hamidullah"
-- edition sourced via api.alquran.cloud, before the Phase 2A source-
-- governance research (20260820100000, see the Kazimirski content_sources
-- row's own notes) discovered that this specific edition -- the King Fahd
-- Complex / Muslim World League revision of Hamidullah's translation --
-- was altered without Hamidullah's consent (he objected in a published
-- 1989 open letter to King Fahd). That discovery was never acted on for
-- the already-seeded rows; this migration closes that gap.
--
-- What this does, in order:
--   1. Registers fr.hamidullah formally in content_sources as
--      verification_status = 'disputed' -- so the dispute is a queryable
--      fact, not just a comment buried in an unrelated row's notes.
--   2. Preserves the exact 58 existing values, unmodified, in the governed
--      translations table, attributed to that disputed source -- nothing
--      is deleted; provenance is fully retained for future reference.
--   3. Suspends (status = 'suspended', not deleted) any review_items rows
--      that were scheduled from this specific disputed text -- identified
--      narrowly by (item_key, back) exact match against the known 58
--      (surah:ayah, text) pairs, never a broad/fuzzy match, and never
--      touching a same-ayah review card scheduled from English text. This
--      reuses the app's existing "suspended" status, already honored by
--      every review-surfacing query (src/lib/study.ts, src/lib/memorization.ts)
--      -- no application code changes are required for this to take effect.
--   4. Nulls translation_fr on exactly those 58 ayahs rows -- the app's
--      existing null -> "translation not yet available" fallback (see
--      ayahTranslation() in src/lib/quran.ts) then handles display with
--      zero new frontend logic.
--
-- Touches ONLY: content_sources (1 insert), translations (58 inserts),
-- review_items (0+ status updates, narrowly scoped), ayahs.translation_fr
-- (58 updates, that column only). Never touches ayahs.arabic_text,
-- ayahs.translation_en, or any translations row belonging to another
-- source (e.g. Pickthall). Every precondition below must hold or the
-- migration aborts before making any change; every postcondition is
-- re-verified before commit.

DO $$
DECLARE
  v_disputed_count integer;
  v_surah_count integer;
  v_surah_numbers integer[];
  v_existing_source_count integer;
  v_total_ayahs integer;
  v_pickthall_count integer;
BEGIN
  -- Precondition 1: exactly 58 disputed legacy French rows.
  SELECT count(*) INTO v_disputed_count
  FROM public.ayahs WHERE translation_fr IS NOT NULL;
  IF v_disputed_count != 58 THEN
    RAISE EXCEPTION 'Precondition failed: expected exactly 58 non-null ayahs.translation_fr rows, found %. Aborting -- data has drifted since this migration was verified against production.', v_disputed_count;
  END IF;

  -- Precondition 2: exactly the 7 expected surahs, no others.
  SELECT array_agg(DISTINCT surah_number ORDER BY surah_number) INTO v_surah_numbers
  FROM public.ayahs WHERE translation_fr IS NOT NULL;
  IF v_surah_numbers != ARRAY[1, 67, 103, 108, 112, 113, 114] THEN
    RAISE EXCEPTION 'Precondition failed: expected disputed French rows in exactly surahs {1,67,103,108,112,113,114}, found %. Aborting.', v_surah_numbers;
  END IF;

  -- Precondition 3: no existing fr.hamidullah content_sources row (this
  -- migration must not run twice, and must not collide with a row someone
  -- else already inserted).
  SELECT count(*) INTO v_existing_source_count
  FROM public.content_sources
  WHERE edition_identifier = 'fr.hamidullah-crf' OR translator = 'Muhammad Hamidullah';
  IF v_existing_source_count != 0 THEN
    RAISE EXCEPTION 'Precondition failed: a content_sources row for fr.hamidullah already exists (% row(s)). Aborting to avoid a duplicate/conflicting registration.', v_existing_source_count;
  END IF;

  -- Precondition 4 (canonical Arabic baseline, re-checked as a
  -- postcondition too): exactly 6236 canonical ayahs.
  SELECT count(*) INTO v_total_ayahs FROM public.ayahs;
  IF v_total_ayahs != 6236 THEN
    RAISE EXCEPTION 'Precondition failed: expected exactly 6236 canonical ayahs, found %. Aborting -- this migration must never run against an incomplete or unexpected Arabic dataset.', v_total_ayahs;
  END IF;

  -- Precondition 5 (English baseline, re-checked as a postcondition too):
  -- the verified Pickthall source's translation count is untouched by
  -- this migration and must remain whatever it is now, unchanged, after.
  SELECT count(*) INTO v_pickthall_count
  FROM public.translations t
  JOIN public.content_sources cs ON cs.id = t.source_id
  WHERE cs.edition_identifier = 'pickthall-gutenberg-16955' AND cs.verification_status = 'verified';
  IF v_pickthall_count != 6236 THEN
    RAISE EXCEPTION 'Precondition failed: expected exactly 6236 verified Pickthall translation rows, found %. Aborting -- this migration assumes the English governed source is already complete and must not run against a partial state.', v_pickthall_count;
  END IF;

  RAISE NOTICE 'All preconditions satisfied: % disputed rows across surahs %, no existing fr.hamidullah source, % canonical ayahs, % Pickthall rows. Proceeding.', v_disputed_count, v_surah_numbers, v_total_ayahs, v_pickthall_count;
END $$;

-- Step 1: formally register the disputed source.
DO $$
DECLARE
  v_source_id uuid;
BEGIN
  INSERT INTO public.content_sources
    (content_type, provider_name, dataset_name, edition_identifier, language,
     translator, version, license_name, license_url, attribution_required,
     modification_restricted, source_url, public_domain, legacy_interim,
     verification_status, notes)
  VALUES
    ('translation', 'api.alquran.cloud (Al Quran Cloud)', 'French Quran Translation',
     'fr.hamidullah-crf', 'fr',
     'Muhammad Hamidullah', 'King Fahd Complex / Muslim World League revision (exact printing/date not independently confirmed)',
     'Disputed / rights not cleared', NULL,
     true, true,
     'https://api.alquran.cloud/',
     false, true, 'disputed',
     'Formally registers the source of the 58 legacy ayahs.translation_fr rows seeded by migration 20260818042151, retroactively -- this is not a fresh import. Hamidullah objected in a published 1989 open letter to King Fahd to the Muslim World League/King Fahd Complex''s practice of revising Qur''an translations without translator consent; his own translation was subsequently revised in 1990 and 2000 under this same practice. This specific edition was deliberately excluded from further use once that history was discovered (see the kazimirski-1869 row''s notes, added two days after this data was originally seeded). Neither Tanzil.net nor QuranEnc.com, the two redistribution points checked, disclose which exact printing they serve, so the specific altered passages cannot be independently verified either way -- registered disputed on the documented consent/process objection, not on a verified list of specific altered verses. Not public domain: translator died 2002, protected in France until 2072 regardless of edition. The 58 corresponding translations rows below preserve the exact original text for provenance; ayahs.translation_fr for these rows is nulled in the same migration so nothing disputed is served to users while this is unresolved.')
  RETURNING id INTO v_source_id;

  -- Step 2: preserve the 58 existing values, unmodified, under this source.
  INSERT INTO public.translations (surah_number, ayah_number, text, source_id) VALUES
  (1, 1, 'Au nom d''Allah, le Tout Miséricordieux, le Très Miséricordieux.', v_source_id),
  (1, 2, 'Louange à Allah, Seigneur de l''univers.', v_source_id),
  (1, 3, 'Le Tout Miséricordieux, le Très Miséricordieux,', v_source_id),
  (1, 4, 'Maître du Jour de la rétribution.', v_source_id),
  (1, 5, 'C''est Toi [Seul] que nous adorons, et c''est Toi [Seul] dont nous implorons secours.', v_source_id),
  (1, 6, 'Guide-nous dans le droit chemin,', v_source_id),
  (1, 7, 'le chemin de ceux que Tu as comblés de faveurs, non pas de ceux qui ont encouru Ta colère, ni des égarés.', v_source_id),
  (67, 1, 'Béni soit celui dans la main de qui est la royauté, et Il est Omnipotent.', v_source_id),
  (67, 2, 'Celui qui a créé la mort et la vie afin de vous éprouver (et de savoir) qui de vous est le meilleur en œuvre, et c''est Lui le Puissant, le Pardonneur.', v_source_id),
  (67, 3, 'Celui qui a créé sept cieux superposés sans que tu voies de disproportion en la création du Tout Miséricordieux. Ramène [sur elle] le regard. Y vois-tu une brèche quelconque?', v_source_id),
  (67, 4, 'Puis, retourne ton regard à deux fois: le regard te reviendra humilié et frustré.', v_source_id),
  (67, 5, 'Nous avons effectivement embelli le ciel le plus proche avec des lampes [des étoiles] dont Nous avons fait des projectiles pour lapider les diables et Nous leur avons préparé le châtiment de la Fournaise.', v_source_id),
  (67, 6, 'Ceux qui ont mécru à leur Seigneur auront le châtiment de l''Enfer. Et quelle mauvaise destination!', v_source_id),
  (67, 7, 'Quand ils y seront jetés, ils lui entendront un gémissement, tandis qu''il bouillonne.', v_source_id),
  (67, 8, 'Peu s''en faut que, de rage, il n''éclate. Toutes les fois qu''un groupe y est jeté, ses gardiens leur demandent: «Quoi! ne vous est-il pas venu d''avertisseur?»', v_source_id),
  (67, 9, 'Ils dirent: «Mais si! un avertisseur nous était venu certes, mais nous avons crié au mensonge et avons dit: Allah n''a rien fait descendre: vous n''êtes que dans un grand égarement».', v_source_id),
  (67, 10, 'Et ils dirent: «Si nous avions écouté ou raisonné, nous ne serions pas parmi les gens de la Fournaise».', v_source_id),
  (67, 11, 'Ils ont reconnu leur péché. Que les gens de la Fournaise soient anéantis à jamais.', v_source_id),
  (67, 12, 'Ceux qui redoutent leur Seigneur bien qu''ils ne L''aient jamais vu auront un pardon et une grande récompense.', v_source_id),
  (67, 13, 'Que vous cachiez votre parole ou la divulguiez Il connaît bien le contenu des poitrines.', v_source_id),
  (67, 14, 'Ne connaît-Il pas ce qu''Il a créé alors que c''est Lui le Compatissant, le Parfaitement Connaisseur.', v_source_id),
  (67, 15, 'C''est Lui qui vous a soumis la terre: parcourez donc ses grandes étendues. Mangez de ce qu''Il vous fournit. Vers Lui est la Résurrection.', v_source_id),
  (67, 16, 'Etes-vous à l''abri que Celui qui est au ciel vous enfouisse en la terre? Et voici qu''elle tremble!', v_source_id),
  (67, 17, 'Ou êtes-vous à l''abri que Celui qui est au ciel envoie contre vous un ouragan de pierres? Vous saurez ainsi quel fut Mon avertissement.', v_source_id),
  (67, 18, 'En effet, ceux d''avant eux avaient crié au mensonge. Quelle fut alors Ma réprobation!', v_source_id),
  (67, 19, 'N''ont-ils pas vu les oiseaux au-dessus d''eux, déployant et repliant leurs ailes tour à tour? Seul le Tout Miséricordieux les soutient. Car Il est sur toute chose, Clairvoyant.', v_source_id),
  (67, 20, 'Quel est celui qui constituerait pour vous une armée [capable] de vous secourir, en dehors du Tout Miséricordieux? En vérité les mécréants sont dans l''illusion complète.', v_source_id),
  (67, 21, 'Ou quel est celui qui vous donnera votre subsistance s''Il s''arrête de fournir Son attribution? Mais ils persistent dans leur insolence et dans leur répulsion.', v_source_id),
  (67, 22, 'Qui est donc mieux guidé? Celui qui marche face contre terre ou celui qui marche redressé sur un chemin droit.', v_source_id),
  (67, 23, 'Dis: «C''est Lui qui vous a créés et vous a donné l''ouïe, les yeux et les cœurs». Mais vous êtes rarement reconnaissants!', v_source_id),
  (67, 24, 'Dis: «C''est Lui qui vous a répandus sur la terre, et c''est vers Lui que vous serez rassemblés».', v_source_id),
  (67, 25, 'Et ils disent: «A quand cette promesse si vous êtes véridiques?»', v_source_id),
  (67, 26, 'Dis: «Allah seul [en] a la connaissance. Et moi je ne suis qu''un avertisseur clair».', v_source_id),
  (67, 27, 'Puis, quand ils verront (le châtiment) de près, les visages de ceux qui ont mécru seront affligés. Et il leur sera dit: «Voilà ce que vous réclamiez».', v_source_id),
  (67, 28, 'Dis: «Que vous en semble? Qu''Allah me fasse périr ainsi que ceux qui sont avec moi ou qu''Il nous fasse miséricorde, qui protégera alors les mécréants d''un châtiment douloureux?»', v_source_id),
  (67, 29, 'Dis: «C''est Lui, le Tout Miséricordieux. Nous croyons en Lui et c''est en Lui que nous plaçons notre confiance. Vous saurez bientôt qui est dans un égarement évident».', v_source_id),
  (67, 30, 'Dis: «Que vous en semble? Si votre eau était absorbée au plus profond de la terre, qui donc vous apporterait de l''eau de source?»', v_source_id),
  (103, 1, 'Par le Temps!', v_source_id),
  (103, 2, 'L''homme est certes, en perdition,', v_source_id),
  (103, 3, 'sauf ceux qui croient et accomplissent les bonnes œuvres, s''enjoignent mutuellement la vérité et s''enjoignent mutuellement l''endurance.', v_source_id),
  (108, 1, 'Nous t''avons certes, accordé l''Abondance.', v_source_id),
  (108, 2, 'Accomplis la Salât pour ton Seigneur et sacrifie.', v_source_id),
  (108, 3, 'Celui qui te hait sera certes, sans postérité.', v_source_id),
  (112, 1, 'Dis: «Il est Allah, Unique.', v_source_id),
  (112, 2, 'Allah, Le Seul à être imploré pour ce que nous désirons.', v_source_id),
  (112, 3, 'Il n''a jamais engendré, n''a pas été engendré non plus.', v_source_id),
  (112, 4, 'Et nul n''est égal à Lui».', v_source_id),
  (113, 1, 'Dis: «Je cherche protection auprès du Seigneur de l''aube naissante,', v_source_id),
  (113, 2, 'contre le mal des êtres qu''Il a créés,', v_source_id),
  (113, 3, 'contre le mal de l''obscurité quand elle s''approfondit,', v_source_id),
  (113, 4, 'contre le mal de celles qui soufflent [les sorcières] sur les nœuds,', v_source_id),
  (113, 5, 'et contre le mal de l''envieux quand il envie».', v_source_id),
  (114, 1, 'Dis: «Je cherche protection auprès du Seigneur des hommes.', v_source_id),
  (114, 2, 'Le Souverain des hommes,', v_source_id),
  (114, 3, 'Dieu des hommes,', v_source_id),
  (114, 4, 'contre le mal du mauvais conseiller, furtif,', v_source_id),
  (114, 5, 'qui souffle le mal dans les poitrines des hommes,', v_source_id),
  (114, 6, 'qu''il (le conseiller) soit un djinn, ou un être humain».', v_source_id);

  RAISE NOTICE 'Registered disputed content_sources row % and inserted 58 translations rows under it.', v_source_id;
END $$;

-- Step 3: suspend (never delete) any review_items scheduled from this
-- exact disputed text. Narrow, exact (item_key, back) match only -- a
-- same-ayah review card scheduled from English (Pickthall) text has a
-- different `back` value and is never touched; review items for any
-- other ayah, or any non-"ayah" item_type (word/root/concept), never
-- match item_key at all.
WITH disputed_pairs (item_key, back_text) AS (
  VALUES
  ('ayah:1:1', 'Au nom d''Allah, le Tout Miséricordieux, le Très Miséricordieux.'),
  ('ayah:1:2', 'Louange à Allah, Seigneur de l''univers.'),
  ('ayah:1:3', 'Le Tout Miséricordieux, le Très Miséricordieux,'),
  ('ayah:1:4', 'Maître du Jour de la rétribution.'),
  ('ayah:1:5', 'C''est Toi [Seul] que nous adorons, et c''est Toi [Seul] dont nous implorons secours.'),
  ('ayah:1:6', 'Guide-nous dans le droit chemin,'),
  ('ayah:1:7', 'le chemin de ceux que Tu as comblés de faveurs, non pas de ceux qui ont encouru Ta colère, ni des égarés.'),
  ('ayah:67:1', 'Béni soit celui dans la main de qui est la royauté, et Il est Omnipotent.'),
  ('ayah:67:2', 'Celui qui a créé la mort et la vie afin de vous éprouver (et de savoir) qui de vous est le meilleur en œuvre, et c''est Lui le Puissant, le Pardonneur.'),
  ('ayah:67:3', 'Celui qui a créé sept cieux superposés sans que tu voies de disproportion en la création du Tout Miséricordieux. Ramène [sur elle] le regard. Y vois-tu une brèche quelconque?'),
  ('ayah:67:4', 'Puis, retourne ton regard à deux fois: le regard te reviendra humilié et frustré.'),
  ('ayah:67:5', 'Nous avons effectivement embelli le ciel le plus proche avec des lampes [des étoiles] dont Nous avons fait des projectiles pour lapider les diables et Nous leur avons préparé le châtiment de la Fournaise.'),
  ('ayah:67:6', 'Ceux qui ont mécru à leur Seigneur auront le châtiment de l''Enfer. Et quelle mauvaise destination!'),
  ('ayah:67:7', 'Quand ils y seront jetés, ils lui entendront un gémissement, tandis qu''il bouillonne.'),
  ('ayah:67:8', 'Peu s''en faut que, de rage, il n''éclate. Toutes les fois qu''un groupe y est jeté, ses gardiens leur demandent: «Quoi! ne vous est-il pas venu d''avertisseur?»'),
  ('ayah:67:9', 'Ils dirent: «Mais si! un avertisseur nous était venu certes, mais nous avons crié au mensonge et avons dit: Allah n''a rien fait descendre: vous n''êtes que dans un grand égarement».'),
  ('ayah:67:10', 'Et ils dirent: «Si nous avions écouté ou raisonné, nous ne serions pas parmi les gens de la Fournaise».'),
  ('ayah:67:11', 'Ils ont reconnu leur péché. Que les gens de la Fournaise soient anéantis à jamais.'),
  ('ayah:67:12', 'Ceux qui redoutent leur Seigneur bien qu''ils ne L''aient jamais vu auront un pardon et une grande récompense.'),
  ('ayah:67:13', 'Que vous cachiez votre parole ou la divulguiez Il connaît bien le contenu des poitrines.'),
  ('ayah:67:14', 'Ne connaît-Il pas ce qu''Il a créé alors que c''est Lui le Compatissant, le Parfaitement Connaisseur.'),
  ('ayah:67:15', 'C''est Lui qui vous a soumis la terre: parcourez donc ses grandes étendues. Mangez de ce qu''Il vous fournit. Vers Lui est la Résurrection.'),
  ('ayah:67:16', 'Etes-vous à l''abri que Celui qui est au ciel vous enfouisse en la terre? Et voici qu''elle tremble!'),
  ('ayah:67:17', 'Ou êtes-vous à l''abri que Celui qui est au ciel envoie contre vous un ouragan de pierres? Vous saurez ainsi quel fut Mon avertissement.'),
  ('ayah:67:18', 'En effet, ceux d''avant eux avaient crié au mensonge. Quelle fut alors Ma réprobation!'),
  ('ayah:67:19', 'N''ont-ils pas vu les oiseaux au-dessus d''eux, déployant et repliant leurs ailes tour à tour? Seul le Tout Miséricordieux les soutient. Car Il est sur toute chose, Clairvoyant.'),
  ('ayah:67:20', 'Quel est celui qui constituerait pour vous une armée [capable] de vous secourir, en dehors du Tout Miséricordieux? En vérité les mécréants sont dans l''illusion complète.'),
  ('ayah:67:21', 'Ou quel est celui qui vous donnera votre subsistance s''Il s''arrête de fournir Son attribution? Mais ils persistent dans leur insolence et dans leur répulsion.'),
  ('ayah:67:22', 'Qui est donc mieux guidé? Celui qui marche face contre terre ou celui qui marche redressé sur un chemin droit.'),
  ('ayah:67:23', 'Dis: «C''est Lui qui vous a créés et vous a donné l''ouïe, les yeux et les cœurs». Mais vous êtes rarement reconnaissants!'),
  ('ayah:67:24', 'Dis: «C''est Lui qui vous a répandus sur la terre, et c''est vers Lui que vous serez rassemblés».'),
  ('ayah:67:25', 'Et ils disent: «A quand cette promesse si vous êtes véridiques?»'),
  ('ayah:67:26', 'Dis: «Allah seul [en] a la connaissance. Et moi je ne suis qu''un avertisseur clair».'),
  ('ayah:67:27', 'Puis, quand ils verront (le châtiment) de près, les visages de ceux qui ont mécru seront affligés. Et il leur sera dit: «Voilà ce que vous réclamiez».'),
  ('ayah:67:28', 'Dis: «Que vous en semble? Qu''Allah me fasse périr ainsi que ceux qui sont avec moi ou qu''Il nous fasse miséricorde, qui protégera alors les mécréants d''un châtiment douloureux?»'),
  ('ayah:67:29', 'Dis: «C''est Lui, le Tout Miséricordieux. Nous croyons en Lui et c''est en Lui que nous plaçons notre confiance. Vous saurez bientôt qui est dans un égarement évident».'),
  ('ayah:67:30', 'Dis: «Que vous en semble? Si votre eau était absorbée au plus profond de la terre, qui donc vous apporterait de l''eau de source?»'),
  ('ayah:103:1', 'Par le Temps!'),
  ('ayah:103:2', 'L''homme est certes, en perdition,'),
  ('ayah:103:3', 'sauf ceux qui croient et accomplissent les bonnes œuvres, s''enjoignent mutuellement la vérité et s''enjoignent mutuellement l''endurance.'),
  ('ayah:108:1', 'Nous t''avons certes, accordé l''Abondance.'),
  ('ayah:108:2', 'Accomplis la Salât pour ton Seigneur et sacrifie.'),
  ('ayah:108:3', 'Celui qui te hait sera certes, sans postérité.'),
  ('ayah:112:1', 'Dis: «Il est Allah, Unique.'),
  ('ayah:112:2', 'Allah, Le Seul à être imploré pour ce que nous désirons.'),
  ('ayah:112:3', 'Il n''a jamais engendré, n''a pas été engendré non plus.'),
  ('ayah:112:4', 'Et nul n''est égal à Lui».'),
  ('ayah:113:1', 'Dis: «Je cherche protection auprès du Seigneur de l''aube naissante,'),
  ('ayah:113:2', 'contre le mal des êtres qu''Il a créés,'),
  ('ayah:113:3', 'contre le mal de l''obscurité quand elle s''approfondit,'),
  ('ayah:113:4', 'contre le mal de celles qui soufflent [les sorcières] sur les nœuds,'),
  ('ayah:113:5', 'et contre le mal de l''envieux quand il envie».'),
  ('ayah:114:1', 'Dis: «Je cherche protection auprès du Seigneur des hommes.'),
  ('ayah:114:2', 'Le Souverain des hommes,'),
  ('ayah:114:3', 'Dieu des hommes,'),
  ('ayah:114:4', 'contre le mal du mauvais conseiller, furtif,'),
  ('ayah:114:5', 'qui souffle le mal dans les poitrines des hommes,'),
  ('ayah:114:6', 'qu''il (le conseiller) soit un djinn, ou un être humain».'))
UPDATE public.review_items ri
SET status = 'suspended', updated_at = now()
FROM disputed_pairs dp
WHERE ri.item_type = 'ayah'
  AND ri.item_key = dp.item_key
  AND ri.back = dp.back_text
  AND ri.status != 'suspended';

-- Step 4: null the legacy column for exactly these 58 rows -- the existing
-- null -> "translation not yet available" fallback then handles display,
-- no frontend change required.
UPDATE public.ayahs
SET translation_fr = NULL
WHERE translation_fr IS NOT NULL
  AND (surah_number, ayah_number) IN (
    (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7),
    (67, 1), (67, 2), (67, 3), (67, 4), (67, 5), (67, 6), (67, 7), (67, 8), (67, 9), (67, 10), (67, 11), (67, 12), (67, 13), (67, 14), (67, 15), (67, 16), (67, 17), (67, 18), (67, 19), (67, 20), (67, 21), (67, 22), (67, 23), (67, 24), (67, 25), (67, 26), (67, 27), (67, 28), (67, 29), (67, 30),
    (103, 1), (103, 2), (103, 3),
    (108, 1), (108, 2), (108, 3),
    (112, 1), (112, 2), (112, 3), (112, 4),
    (113, 1), (113, 2), (113, 3), (113, 4), (113, 5),
    (114, 1), (114, 2), (114, 3), (114, 4), (114, 5), (114, 6)
  );

-- Postconditions: re-verify the end state before this migration commits.
DO $$
DECLARE
  v_remaining_disputed integer;
  v_new_translations_count integer;
  v_source_status text;
  v_total_ayahs integer;
  v_pickthall_count integer;
BEGIN
  SELECT count(*) INTO v_remaining_disputed FROM public.ayahs WHERE translation_fr IS NOT NULL;
  IF v_remaining_disputed != 0 THEN
    RAISE EXCEPTION 'Postcondition failed: expected 0 remaining ayahs.translation_fr rows, found %. Aborting.', v_remaining_disputed;
  END IF;

  SELECT count(*) INTO v_new_translations_count
  FROM public.translations t
  JOIN public.content_sources cs ON cs.id = t.source_id
  WHERE cs.edition_identifier = 'fr.hamidullah-crf';
  IF v_new_translations_count != 58 THEN
    RAISE EXCEPTION 'Postcondition failed: expected exactly 58 governed disputed translations rows, found %. Aborting.', v_new_translations_count;
  END IF;

  SELECT verification_status INTO v_source_status
  FROM public.content_sources WHERE edition_identifier = 'fr.hamidullah-crf';
  IF v_source_status != 'disputed' THEN
    RAISE EXCEPTION 'Postcondition failed: expected the fr.hamidullah-crf source to be verification_status = disputed, found %. Aborting.', v_source_status;
  END IF;

  SELECT count(*) INTO v_total_ayahs FROM public.ayahs;
  IF v_total_ayahs != 6236 THEN
    RAISE EXCEPTION 'Postcondition failed: canonical ayahs row count changed from 6236 to %. Aborting -- canonical Arabic must never be affected by this migration.', v_total_ayahs;
  END IF;

  SELECT count(*) INTO v_pickthall_count
  FROM public.translations t
  JOIN public.content_sources cs ON cs.id = t.source_id
  WHERE cs.edition_identifier = 'pickthall-gutenberg-16955' AND cs.verification_status = 'verified';
  IF v_pickthall_count != 6236 THEN
    RAISE EXCEPTION 'Postcondition failed: verified Pickthall translation count changed from 6236 to %. Aborting -- the English governed source must never be affected by this migration.', v_pickthall_count;
  END IF;

  RAISE NOTICE 'All postconditions satisfied: 0 disputed legacy rows remain, 58 governed disputed rows preserved, source correctly marked disputed, 6236 canonical ayahs and 6236 Pickthall translations unchanged.';
END $$;
