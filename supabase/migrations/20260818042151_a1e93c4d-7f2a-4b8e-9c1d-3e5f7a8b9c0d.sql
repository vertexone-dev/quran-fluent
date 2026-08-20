-- Qur'an text reference data (public, read-only): a curated V1 bootstrap set,
-- not the full 114-surah Mushaf. Covers Al-Fatiha plus the short, commonly
-- memorized surahs referenced throughout the app's existing copy (Al-Ikhlas,
-- Al-Falaq, An-Nas, Al-Kawthar, Al-Asr, Al-Mulk). Bookmarks, notes and
-- memorization progress key off (surah_number, ayah_number) here.
--
-- Arabic text: Uthmani script (Tanzil/King Fahd Complex standard digital
-- Mushaf text), sourced from api.alquran.cloud (edition "quran-uthmani").
-- English: Sahih International (edition "en.sahih", matches the app's
-- existing learning_preferences.preferred_translation default of
-- 'en_sahih'). French: Muhammad Hamidullah (edition "fr.hamidullah", the
-- standard French Qur'an translation).
--
-- Bismillah handling: the source text prepends the Bismillah to the first
-- numbered ayah's text for every surah except Al-Fatiha and At-Tawbah. That
-- is correct for print/typographic display but wrong for a numbered
-- (surah_number, ayah_number) -> arabic_text model intended for word-level
-- analysis, memorization and Tajweed work — ayah_number = 1 must contain
-- only that ayah's own text. The Bismillah prefix has been stripped from
-- ayah 1 of every surah below except Al-Fatiha, where the Bismillah IS the
-- canonical ayah 1 (Al-Fatiha has 7 ayat under this numbering, Bismillah
-- included) and must stay as-is. Cross-verified against api.quran.com v4
-- (Quran Foundation's official API, the quran.com backend): its
-- /chapters/{id} endpoint's own `bismillah_pre` field agrees exactly with
-- this split (false for Al-Fatiha, true for the other six), and its
-- Bismillah-free /verses/by_chapter/{id} `text_uthmani` values match this
-- migration's post-strip ayah 1 text for all six affected surahs, word for
-- word (the only differences found across all 58 ayahs were tatweel/small
-- Quranic-annotation-mark formatting, not wording, between the two
-- digitizations). The Bismillah string used for stripping was extracted
-- from the source data itself (Al-Fatiha's own ayah 1), not hand-typed, to
-- avoid exactly this kind of transcription risk.
--
-- bismillah_pre mirrors that quran.com field: true means the surah's
-- recitation opens with a Bismillah that is NOT itself a numbered ayah (the
-- reader should render it once, above ayah 1); false means either no
-- Bismillah (At-Tawbah, not in this set) or — Al-Fatiha's unique case —
-- the Bismillah already IS ayah 1's stored text, so no separate header
-- should be rendered.
--
-- The full Verified Qur'an Knowledge Layer (complete Mushaf, multiple
-- qira'at, word-by-word morphology, scholarly review) is a later phase.

CREATE TABLE public.surahs (
  number INTEGER PRIMARY KEY CHECK (number BETWEEN 1 AND 114),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  ayah_count INTEGER NOT NULL CHECK (ayah_count > 0),
  revelation_type TEXT NOT NULL CHECK (revelation_type IN ('meccan', 'medinan')),
  bismillah_pre BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.surahs TO authenticated, anon;
GRANT ALL ON public.surahs TO service_role;
ALTER TABLE public.surahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surahs_read_all" ON public.surahs FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE public.ayahs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surah_number INTEGER NOT NULL REFERENCES public.surahs(number) ON DELETE CASCADE,
  ayah_number INTEGER NOT NULL CHECK (ayah_number > 0),
  arabic_text TEXT NOT NULL,
  translation_en TEXT NOT NULL,
  translation_fr TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (surah_number, ayah_number)
);
CREATE INDEX ayahs_surah_idx ON public.ayahs (surah_number, ayah_number);

GRANT SELECT ON public.ayahs TO authenticated, anon;
GRANT ALL ON public.ayahs TO service_role;
ALTER TABLE public.ayahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ayahs_read_all" ON public.ayahs FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.surahs (number, name_en, name_ar, name_fr, ayah_count, revelation_type, bismillah_pre) VALUES
(1, 'Al-Fatiha', 'سُورَةُ ٱلْفَاتِحَةِ', 'Al-Fatiha', 7, 'meccan', false),
(67, 'Al-Mulk', 'سُورَةُ المُلۡكِ', 'Al-Mulk', 30, 'meccan', true),
(103, 'Al-Asr', 'سُورَةُ العَصۡرِ', 'Al-Asr', 3, 'meccan', true),
(108, 'Al-Kawthar', 'سُورَةُ الكَوۡثَرِ', 'Al-Kawthar', 3, 'meccan', true),
(112, 'Al-Ikhlas', 'سُورَةُ الإِخۡلَاصِ', 'Al-Ikhlas', 4, 'meccan', true),
(113, 'Al-Falaq', 'سُورَةُ الفَلَقِ', 'Al-Falaq', 5, 'meccan', true),
(114, 'An-Nas', 'سُورَةُ النَّاسِ', 'An-Nas', 6, 'meccan', true);

INSERT INTO public.ayahs (surah_number, ayah_number, arabic_text, translation_en, translation_fr) VALUES
(1, 1, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 'In the name of Allah, the Entirely Merciful, the Especially Merciful.', 'Au nom d''Allah, le Tout Miséricordieux, le Très Miséricordieux.'),
(1, 2, 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ', '[All] praise is [due] to Allah, Lord of the worlds -', 'Louange à Allah, Seigneur de l''univers.'),
(1, 3, 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 'The Entirely Merciful, the Especially Merciful,', 'Le Tout Miséricordieux, le Très Miséricordieux,'),
(1, 4, 'مَٰلِكِ يَوْمِ ٱلدِّينِ', 'Sovereign of the Day of Recompense.', 'Maître du Jour de la rétribution.'),
(1, 5, 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', 'It is You we worship and You we ask for help.', 'C''est Toi [Seul] que nous adorons, et c''est Toi [Seul] dont nous implorons secours.'),
(1, 6, 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ', 'Guide us to the straight path -', 'Guide-nous dans le droit chemin,'),
(1, 7, 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ', 'The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray.', 'le chemin de ceux que Tu as comblés de faveurs, non pas de ceux qui ont encouru Ta colère, ni des égarés.'),
(67, 1, 'تَبَٰرَكَ ٱلَّذِى بِيَدِهِ ٱلْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَىْءٍۢ قَدِيرٌ', 'Blessed is He in whose hand is dominion, and He is over all things competent -', 'Béni soit celui dans la main de qui est la royauté, et Il est Omnipotent.'),
(67, 2, 'ٱلَّذِى خَلَقَ ٱلْمَوْتَ وَٱلْحَيَوٰةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًۭا ۚ وَهُوَ ٱلْعَزِيزُ ٱلْغَفُورُ', '[He] who created death and life to test you [as to] which of you is best in deed - and He is the Exalted in Might, the Forgiving -', 'Celui qui a créé la mort et la vie afin de vous éprouver (et de savoir) qui de vous est le meilleur en œuvre, et c''est Lui le Puissant, le Pardonneur.'),
(67, 3, 'ٱلَّذِى خَلَقَ سَبْعَ سَمَٰوَٰتٍۢ طِبَاقًۭا ۖ مَّا تَرَىٰ فِى خَلْقِ ٱلرَّحْمَٰنِ مِن تَفَٰوُتٍۢ ۖ فَٱرْجِعِ ٱلْبَصَرَ هَلْ تَرَىٰ مِن فُطُورٍۢ', '[And] who created seven heavens in layers. You do not see in the creation of the Most Merciful any inconsistency. So return [your] vision [to the sky]; do you see any breaks?', 'Celui qui a créé sept cieux superposés sans que tu voies de disproportion en la création du Tout Miséricordieux. Ramène [sur elle] le regard. Y vois-tu une brèche quelconque?'),
(67, 4, 'ثُمَّ ٱرْجِعِ ٱلْبَصَرَ كَرَّتَيْنِ يَنقَلِبْ إِلَيْكَ ٱلْبَصَرُ خَاسِئًۭا وَهُوَ حَسِيرٌۭ', 'Then return [your] vision twice again. [Your] vision will return to you humbled while it is fatigued.', 'Puis, retourne ton regard à deux fois: le regard te reviendra humilié et frustré.'),
(67, 5, 'وَلَقَدْ زَيَّنَّا ٱلسَّمَآءَ ٱلدُّنْيَا بِمَصَٰبِيحَ وَجَعَلْنَٰهَا رُجُومًۭا لِّلشَّيَٰطِينِ ۖ وَأَعْتَدْنَا لَهُمْ عَذَابَ ٱلسَّعِيرِ', 'And We have certainly beautified the nearest heaven with stars and have made [from] them what is thrown at the devils and have prepared for them the punishment of the Blaze.', 'Nous avons effectivement embelli le ciel le plus proche avec des lampes [des étoiles] dont Nous avons fait des projectiles pour lapider les diables et Nous leur avons préparé le châtiment de la Fournaise.'),
(67, 6, 'وَلِلَّذِينَ كَفَرُوا۟ بِرَبِّهِمْ عَذَابُ جَهَنَّمَ ۖ وَبِئْسَ ٱلْمَصِيرُ', 'And for those who disbelieved in their Lord is the punishment of Hell, and wretched is the destination.', 'Ceux qui ont mécru à leur Seigneur auront le châtiment de l''Enfer. Et quelle mauvaise destination!'),
(67, 7, 'إِذَآ أُلْقُوا۟ فِيهَا سَمِعُوا۟ لَهَا شَهِيقًۭا وَهِىَ تَفُورُ', 'When they are thrown into it, they hear from it a [dreadful] inhaling while it boils up.', 'Quand ils y seront jetés, ils lui entendront un gémissement, tandis qu''il bouillonne.'),
(67, 8, 'تَكَادُ تَمَيَّزُ مِنَ ٱلْغَيْظِ ۖ كُلَّمَآ أُلْقِىَ فِيهَا فَوْجٌۭ سَأَلَهُمْ خَزَنَتُهَآ أَلَمْ يَأْتِكُمْ نَذِيرٌۭ', 'It almost bursts with rage. Every time a company is thrown into it, its keepers ask them, "Did there not come to you a warner?"', 'Peu s''en faut que, de rage, il n''éclate. Toutes les fois qu''un groupe y est jeté, ses gardiens leur demandent: «Quoi! ne vous est-il pas venu d''avertisseur?»'),
(67, 9, 'قَالُوا۟ بَلَىٰ قَدْ جَآءَنَا نَذِيرٌۭ فَكَذَّبْنَا وَقُلْنَا مَا نَزَّلَ ٱللَّهُ مِن شَىْءٍ إِنْ أَنتُمْ إِلَّا فِى ضَلَٰلٍۢ كَبِيرٍۢ', 'They will say," Yes, a warner had come to us, but we denied and said, ''Allah has not sent down anything. You are not but in great error.''"', 'Ils dirent: «Mais si! un avertisseur nous était venu certes, mais nous avons crié au mensonge et avons dit: Allah n''a rien fait descendre: vous n''êtes que dans un grand égarement».'),
(67, 10, 'وَقَالُوا۟ لَوْ كُنَّا نَسْمَعُ أَوْ نَعْقِلُ مَا كُنَّا فِىٓ أَصْحَٰبِ ٱلسَّعِيرِ', 'And they will say, "If only we had been listening or reasoning, we would not be among the companions of the Blaze."', 'Et ils dirent: «Si nous avions écouté ou raisonné, nous ne serions pas parmi les gens de la Fournaise».'),
(67, 11, 'فَٱعْتَرَفُوا۟ بِذَنۢبِهِمْ فَسُحْقًۭا لِّأَصْحَٰبِ ٱلسَّعِيرِ', 'And they will admit their sin, so [it is] alienation for the companions of the Blaze.', 'Ils ont reconnu leur péché. Que les gens de la Fournaise soient anéantis à jamais.'),
(67, 12, 'إِنَّ ٱلَّذِينَ يَخْشَوْنَ رَبَّهُم بِٱلْغَيْبِ لَهُم مَّغْفِرَةٌۭ وَأَجْرٌۭ كَبِيرٌۭ', 'Indeed, those who fear their Lord unseen will have forgiveness and great reward.', 'Ceux qui redoutent leur Seigneur bien qu''ils ne L''aient jamais vu auront un pardon et une grande récompense.'),
(67, 13, 'وَأَسِرُّوا۟ قَوْلَكُمْ أَوِ ٱجْهَرُوا۟ بِهِۦٓ ۖ إِنَّهُۥ عَلِيمٌۢ بِذَاتِ ٱلصُّدُورِ', 'And conceal your speech or publicize it; indeed, He is Knowing of that within the breasts.', 'Que vous cachiez votre parole ou la divulguiez Il connaît bien le contenu des poitrines.'),
(67, 14, 'أَلَا يَعْلَمُ مَنْ خَلَقَ وَهُوَ ٱللَّطِيفُ ٱلْخَبِيرُ', 'Does He who created not know, while He is the Subtle, the Acquainted?', 'Ne connaît-Il pas ce qu''Il a créé alors que c''est Lui le Compatissant, le Parfaitement Connaisseur.'),
(67, 15, 'هُوَ ٱلَّذِى جَعَلَ لَكُمُ ٱلْأَرْضَ ذَلُولًۭا فَٱمْشُوا۟ فِى مَنَاكِبِهَا وَكُلُوا۟ مِن رِّزْقِهِۦ ۖ وَإِلَيْهِ ٱلنُّشُورُ', 'It is He who made the earth tame for you - so walk among its slopes and eat of His provision - and to Him is the resurrection.', 'C''est Lui qui vous a soumis la terre: parcourez donc ses grandes étendues. Mangez de ce qu''Il vous fournit. Vers Lui est la Résurrection.'),
(67, 16, 'ءَأَمِنتُم مَّن فِى ٱلسَّمَآءِ أَن يَخْسِفَ بِكُمُ ٱلْأَرْضَ فَإِذَا هِىَ تَمُورُ', 'Do you feel secure that He who [holds authority] in the heaven would not cause the earth to swallow you and suddenly it would sway?', 'Etes-vous à l''abri que Celui qui est au ciel vous enfouisse en la terre? Et voici qu''elle tremble!'),
(67, 17, 'أَمْ أَمِنتُم مَّن فِى ٱلسَّمَآءِ أَن يُرْسِلَ عَلَيْكُمْ حَاصِبًۭا ۖ فَسَتَعْلَمُونَ كَيْفَ نَذِيرِ', 'Or do you feel secure that He who [holds authority] in the heaven would not send against you a storm of stones? Then you would know how [severe] was My warning.', 'Ou êtes-vous à l''abri que Celui qui est au ciel envoie contre vous un ouragan de pierres? Vous saurez ainsi quel fut Mon avertissement.'),
(67, 18, 'وَلَقَدْ كَذَّبَ ٱلَّذِينَ مِن قَبْلِهِمْ فَكَيْفَ كَانَ نَكِيرِ', 'And already had those before them denied, and how [terrible] was My reproach.', 'En effet, ceux d''avant eux avaient crié au mensonge. Quelle fut alors Ma réprobation!'),
(67, 19, 'أَوَلَمْ يَرَوْا۟ إِلَى ٱلطَّيْرِ فَوْقَهُمْ صَٰٓفَّٰتٍۢ وَيَقْبِضْنَ ۚ مَا يُمْسِكُهُنَّ إِلَّا ٱلرَّحْمَٰنُ ۚ إِنَّهُۥ بِكُلِّ شَىْءٍۭ بَصِيرٌ', 'Do they not see the birds above them with wings outspread and [sometimes] folded in? None holds them [aloft] except the Most Merciful. Indeed He is, of all things, Seeing.', 'N''ont-ils pas vu les oiseaux au-dessus d''eux, déployant et repliant leurs ailes tour à tour? Seul le Tout Miséricordieux les soutient. Car Il est sur toute chose, Clairvoyant.'),
(67, 20, 'أَمَّنْ هَٰذَا ٱلَّذِى هُوَ جُندٌۭ لَّكُمْ يَنصُرُكُم مِّن دُونِ ٱلرَّحْمَٰنِ ۚ إِنِ ٱلْكَٰفِرُونَ إِلَّا فِى غُرُورٍ', 'Or who is it that could be an army for you to aid you other than the Most Merciful? The disbelievers are not but in delusion.', 'Quel est celui qui constituerait pour vous une armée [capable] de vous secourir, en dehors du Tout Miséricordieux? En vérité les mécréants sont dans l''illusion complète.'),
(67, 21, 'أَمَّنْ هَٰذَا ٱلَّذِى يَرْزُقُكُمْ إِنْ أَمْسَكَ رِزْقَهُۥ ۚ بَل لَّجُّوا۟ فِى عُتُوٍّۢ وَنُفُورٍ', 'Or who is it that could provide for you if He withheld His provision? But they have persisted in insolence and aversion.', 'Ou quel est celui qui vous donnera votre subsistance s''Il s''arrête de fournir Son attribution? Mais ils persistent dans leur insolence et dans leur répulsion.'),
(67, 22, 'أَفَمَن يَمْشِى مُكِبًّا عَلَىٰ وَجْهِهِۦٓ أَهْدَىٰٓ أَمَّن يَمْشِى سَوِيًّا عَلَىٰ صِرَٰطٍۢ مُّسْتَقِيمٍۢ', 'Then is one who walks fallen on his face better guided or one who walks erect on a straight path?', 'Qui est donc mieux guidé? Celui qui marche face contre terre ou celui qui marche redressé sur un chemin droit.'),
(67, 23, 'قُلْ هُوَ ٱلَّذِىٓ أَنشَأَكُمْ وَجَعَلَ لَكُمُ ٱلسَّمْعَ وَٱلْأَبْصَٰرَ وَٱلْأَفْـِٔدَةَ ۖ قَلِيلًۭا مَّا تَشْكُرُونَ', 'Say, "It is He who has produced you and made for you hearing and vision and hearts; little are you grateful."', 'Dis: «C''est Lui qui vous a créés et vous a donné l''ouïe, les yeux et les cœurs». Mais vous êtes rarement reconnaissants!'),
(67, 24, 'قُلْ هُوَ ٱلَّذِى ذَرَأَكُمْ فِى ٱلْأَرْضِ وَإِلَيْهِ تُحْشَرُونَ', 'Say, "It is He who has multiplied you throughout the earth, and to Him you will be gathered."', 'Dis: «C''est Lui qui vous a répandus sur la terre, et c''est vers Lui que vous serez rassemblés».'),
(67, 25, 'وَيَقُولُونَ مَتَىٰ هَٰذَا ٱلْوَعْدُ إِن كُنتُمْ صَٰدِقِينَ', 'And they say, "When is this promise, if you should be truthful?"', 'Et ils disent: «A quand cette promesse si vous êtes véridiques?»'),
(67, 26, 'قُلْ إِنَّمَا ٱلْعِلْمُ عِندَ ٱللَّهِ وَإِنَّمَآ أَنَا۠ نَذِيرٌۭ مُّبِينٌۭ', 'Say, "The knowledge is only with Allah, and I am only a clear warner."', 'Dis: «Allah seul [en] a la connaissance. Et moi je ne suis qu''un avertisseur clair».'),
(67, 27, 'فَلَمَّا رَأَوْهُ زُلْفَةًۭ سِيٓـَٔتْ وُجُوهُ ٱلَّذِينَ كَفَرُوا۟ وَقِيلَ هَٰذَا ٱلَّذِى كُنتُم بِهِۦ تَدَّعُونَ', 'But when they see it approaching, the faces of those who disbelieve will be distressed, and it will be said, "This is that for which you used to call."', 'Puis, quand ils verront (le châtiment) de près, les visages de ceux qui ont mécru seront affligés. Et il leur sera dit: «Voilà ce que vous réclamiez».'),
(67, 28, 'قُلْ أَرَءَيْتُمْ إِنْ أَهْلَكَنِىَ ٱللَّهُ وَمَن مَّعِىَ أَوْ رَحِمَنَا فَمَن يُجِيرُ ٱلْكَٰفِرِينَ مِنْ عَذَابٍ أَلِيمٍۢ', 'Say, [O Muhammad], "Have you considered: whether Allah should cause my death and those with me or have mercy upon us, who can protect the disbelievers from a painful punishment?"', 'Dis: «Que vous en semble? Qu''Allah me fasse périr ainsi que ceux qui sont avec moi ou qu''Il nous fasse miséricorde, qui protégera alors les mécréants d''un châtiment douloureux?»'),
(67, 29, 'قُلْ هُوَ ٱلرَّحْمَٰنُ ءَامَنَّا بِهِۦ وَعَلَيْهِ تَوَكَّلْنَا ۖ فَسَتَعْلَمُونَ مَنْ هُوَ فِى ضَلَٰلٍۢ مُّبِينٍۢ', 'Say, "He is the Most Merciful; we have believed in Him, and upon Him we have relied. And you will [come to] know who it is that is in clear error."', 'Dis: «C''est Lui, le Tout Miséricordieux. Nous croyons en Lui et c''est en Lui que nous plaçons notre confiance. Vous saurez bientôt qui est dans un égarement évident».'),
(67, 30, 'قُلْ أَرَءَيْتُمْ إِنْ أَصْبَحَ مَآؤُكُمْ غَوْرًۭا فَمَن يَأْتِيكُم بِمَآءٍۢ مَّعِينٍۭ', 'Say, "Have you considered: if your water was to become sunken [into the earth], then who could bring you flowing water?"', 'Dis: «Que vous en semble? Si votre eau était absorbée au plus profond de la terre, qui donc vous apporterait de l''eau de source?»'),
(103, 1, 'وَٱلْعَصْرِ', 'By time,', 'Par le Temps!'),
(103, 2, 'إِنَّ ٱلْإِنسَٰنَ لَفِى خُسْرٍ', 'Indeed, mankind is in loss,', 'L''homme est certes, en perdition,'),
(103, 3, 'إِلَّا ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّٰلِحَٰتِ وَتَوَاصَوْا۟ بِٱلْحَقِّ وَتَوَاصَوْا۟ بِٱلصَّبْرِ', 'Except for those who have believed and done righteous deeds and advised each other to truth and advised each other to patience.', 'sauf ceux qui croient et accomplissent les bonnes œuvres, s''enjoignent mutuellement la vérité et s''enjoignent mutuellement l''endurance.'),
(108, 1, 'إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ', 'Indeed, We have granted you, [O Muhammad], al-Kawthar.', 'Nous t''avons certes, accordé l''Abondance.'),
(108, 2, 'فَصَلِّ لِرَبِّكَ وَٱنْحَرْ', 'So pray to your Lord and sacrifice [to Him alone].', 'Accomplis la Salât pour ton Seigneur et sacrifie.'),
(108, 3, 'إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ', 'Indeed, your enemy is the one cut off.', 'Celui qui te hait sera certes, sans postérité.'),
(112, 1, 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', 'Say, "He is Allah, [who is] One,', 'Dis: «Il est Allah, Unique.'),
(112, 2, 'ٱللَّهُ ٱلصَّمَدُ', 'Allah, the Eternal Refuge.', 'Allah, Le Seul à être imploré pour ce que nous désirons.'),
(112, 3, 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'He neither begets nor is born,', 'Il n''a jamais engendré, n''a pas été engendré non plus.'),
(112, 4, 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ', 'Nor is there to Him any equivalent."', 'Et nul n''est égal à Lui».'),
(113, 1, 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ', 'Say, "I seek refuge in the Lord of daybreak', 'Dis: «Je cherche protection auprès du Seigneur de l''aube naissante,'),
(113, 2, 'مِن شَرِّ مَا خَلَقَ', 'From the evil of that which He created', 'contre le mal des êtres qu''Il a créés,'),
(113, 3, 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', 'And from the evil of darkness when it settles', 'contre le mal de l''obscurité quand elle s''approfondit,'),
(113, 4, 'وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ', 'And from the evil of the blowers in knots', 'contre le mal de celles qui soufflent [les sorcières] sur les nœuds,'),
(113, 5, 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', 'And from the evil of an envier when he envies."', 'et contre le mal de l''envieux quand il envie».'),
(114, 1, 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ', 'Say, "I seek refuge in the Lord of mankind,', 'Dis: «Je cherche protection auprès du Seigneur des hommes.'),
(114, 2, 'مَلِكِ ٱلنَّاسِ', 'The Sovereign of mankind.', 'Le Souverain des hommes,'),
(114, 3, 'إِلَٰهِ ٱلنَّاسِ', 'The God of mankind,', 'Dieu des hommes,'),
(114, 4, 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ', 'From the evil of the retreating whisperer -', 'contre le mal du mauvais conseiller, furtif,'),
(114, 5, 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ', 'Who whispers [evil] into the breasts of mankind -', 'qui souffle le mal dans les poitrines des hommes,'),
(114, 6, 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ', 'From among the jinn and mankind."', 'qu''il (le conseiller) soit un djinn, ou un être humain».');
