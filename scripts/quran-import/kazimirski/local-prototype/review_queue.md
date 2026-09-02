# Kazimirski French Translation — Human Review Queue (Phase 3 local prototype)

Generated from the REAL imported local database, not the manifest file. `reviewer_decision` and `reviewer_notes` are intentionally blank throughout — this is the human reviewer's job, never pre-filled by this script.

## Tier 1 — Unresolved segments (2)

### Surah 2, source_ordinal 287 (segment `cd44f53f-7595-4790-b720-e9376c3fb722`)

- **French text**: Dieu n’imposera à aucune âme un fardeau qui soit au-dessus de ses forces. Ce qu’elle aura fait sera allégué pour elle ou contre elle. Seigneur, ne nous punis pas des fautes commises par oubli ou par erreur. Seigneur, ne nous impose pas le fardeau que tu avais imposé à ceux qui ont vécu avant nous. Seigneur, ne nous charge pas de ce que nous ne pouvons supporter. Efface nos péchés, pardonne-les-nous, aie pitié de nous ; tu es notre Seigneur. Donne-nous la victoire sur les infidèles.
- **Canonical targets**: none (unresolved)
- **Alignment**: unresolved / unresolved
- **Evidence**: One more physical <li> (287) than Kazimirski's own declared count for this surah (PHASE1-ALIGNMENT-AUDIT.md §4.2). Word-count-drift localization attempted, reported inconclusive. Canonical target genuinely unknown -- never guessed.
- **Reason review needed**: UNRESOLVED: this segment's canonical āyah target has not been determined. Requires direct sentence-by-sentence reading of Kazimirski's French against a verse reference to locate where in the surah this extra segment's content actually belongs.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 36, source_ordinal 84 (segment `14ec6399-d25a-48b4-b7f4-8a204395607e`)

- **French text**: Gloire à celui qui dans ses mains tient la souveraineté sur toutes choses. Vous retournerez tous à lui.
- **Canonical targets**: none (unresolved)
- **Alignment**: unresolved / unresolved
- **Evidence**: One more physical <li> (84) than Kazimirski's own declared count for this surah (PHASE1-ALIGNMENT-AUDIT.md §4.2). Word-count-drift localization attempted, reported inconclusive. Canonical target genuinely unknown -- never guessed.
- **Reason review needed**: UNRESOLVED: this segment's canonical āyah target has not been determined. Requires direct sentence-by-sentence reading of Kazimirski's French against a verse reference to locate where in the surah this extra segment's content actually belongs.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

## Tier 2 — Compound boundary āyahs (8)

### 3:39

- **Canonical Arabic**: فَنَادَتْهُ ٱلْمَلَـٰٓئِكَةُ وَهُوَ قَآئِمٌ يُصَلِّى فِى ٱلْمِحْرَابِ أَنَّ ٱللَّهَ يُبَشِّرُكَ بِيَحْيَىٰ مُصَدِّقًۢا بِكَلِمَةٍ مِّنَ ٱللَّهِ وَسَيِّدًا وَحَصُورًا وَنَبِيًّا مِّنَ ٱلصَّـٰلِحِينَ
- **Contributing segments** (in source_ordinal order):
  - ordinal 33 (`0e620ed2-31b4-4ce8-b3eb-840092781bdd`, compound, needs_review): Et ici Zacharie se mit à prier Dieu. Seigneur, accorde-moi une postérité bénie ; tu aimes à exaucer les prières des suppliants. Ses anges l’appelèrent pendant qu’il priait dans le sanctuaire.
  - ordinal 34 (`723c9389-fd22-4659-97d9-ef820066ce75`, compound, needs_review): Dieu t’annonce la naissance de Yahia (saint Jean), qui confirmera la vérité du Verbe de Dieu ; il sera grand, chaste, un prophète du nombre des justes.
- **Evidence**: 3:39 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### 3:167

- **Canonical Arabic**: وَلِيَعْلَمَ ٱلَّذِينَ نَافَقُوا۟ ۚ وَقِيلَ لَهُمْ تَعَالَوْا۟ قَـٰتِلُوا۟ فِى سَبِيلِ ٱللَّهِ أَوِ ٱدْفَعُوا۟ ۖ قَالُوا۟ لَوْ نَعْلَمُ قِتَالًا لَّٱتَّبَعْنَـٰكُمْ ۗ هُمْ لِلْكُفْرِ يَوْمَئِذٍ أَقْرَبُ مِنْهُمْ لِلْإِيمَـٰنِ ۚ يَقُولُونَ بِأَفْوَٰهِهِم مَّا لَيْسَ فِى قُلُوبِهِمْ ۗ وَٱللَّهُ أَعْلَمُ بِمَا يَكْتُمُونَ
- **Contributing segments** (in source_ordinal order):
  - ordinal 160 (`de5e074e-4fdb-4baf-b5f5-c26a0f7d77e1`, compound, needs_review): Le revers que vous avez éprouvé le jour où les deux armées se sont rencontrées, eut lieu par la volonté de Dieu, afin qu’il distinguât les fidèles des hypocrites. Quand on leur cria : Avancez, combattez dans le sentier de Dieu, repoussez l’ennemi, ils répondirent : Si nous savions combattre, nous vous suivrions. Ce jour-là ils étaient plus près de l’infidélité que de la foi.
  - ordinal 161 (`0add67d2-83e1-48a9-85be-9fe55398e42c`, compound, needs_review): Ils prononçaient de leurs lèvres ce qui n’était point dans leurs cœurs ; mais Dieu connaît ce qu’ils cachent.
- **Evidence**: 3:167 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### 11:39

- **Canonical Arabic**: فَسَوْفَ تَعْلَمُونَ مَن يَأْتِيهِ عَذَابٌ يُخْزِيهِ وَيَحِلُّ عَلَيْهِ عَذَابٌ مُّقِيمٌ
- **Contributing segments** (in source_ordinal order):
  - ordinal 40 (`475bf916-c374-45e9-a18e-08e32a23a60e`, compound, needs_review): Et il construisit un vaisseau, et chaque fois que les chefs de son peuple passaient auprès de lui ils le raillaient. — ne me raillez pas, dit Noé, je vous raillerai à mon tour comme vous me raillez, et vous apprendrez
  - ordinal 41 (`96bad888-441a-4a54-9fee-e184f5753502`, compound, needs_review): Sur qui tombera le châtiment qui le couvrira d’opprobre. Ce châtiment restera perpétuellement sur sa tête.
- **Evidence**: 11:39 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### 14:44

- **Canonical Arabic**: وَأَنذِرِ ٱلنَّاسَ يَوْمَ يَأْتِيهِمُ ٱلْعَذَابُ فَيَقُولُ ٱلَّذِينَ ظَلَمُوا۟ رَبَّنَآ أَخِّرْنَآ إِلَىٰٓ أَجَلٍ قَرِيبٍ نُّجِبْ دَعْوَتَكَ وَنَتَّبِعِ ٱلرُّسُلَ ۗ أَوَلَمْ تَكُونُوٓا۟ أَقْسَمْتُم مِّن قَبْلُ مَا لَكُم مِّن زَوَالٍ
- **Contributing segments** (in source_ordinal order):
  - ordinal 44 (`eddf1e68-38d8-4772-80df-6594ce920cd1`, compound, needs_review): Courant en toute hâte, la tête levée, leurs regards seront immobiles et leurs cœurs vides. Avertis donc les hommes du jour des châtiments.
  - ordinal 45 (`6ed6ff13-ff90-40ea-9ab6-141cef845da4`, compound, needs_review): Seigneur ! s’écrieront les impies, accorde-nous encore un délai, jusqu’à quelque terme rapproché.
  - ordinal 46 (`da77ada0-52c0-4c74-9076-7633c9f28f28`, compound, needs_review): Nous écouterons ton appel à la foi, nous obéirons à tes apôtres. On leur répondra : Ne juriez-vous pas que vous ne changeriez jamais ?
- **Evidence**: 14:44 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### 47:21

- **Canonical Arabic**: طَاعَةٌ وَقَوْلٌ مَّعْرُوفٌ ۚ فَإِذَا عَزَمَ ٱلْأَمْرُ فَلَوْ صَدَقُوا۟ ٱللَّهَ لَكَانَ خَيْرًا لَّهُمْ
- **Contributing segments** (in source_ordinal order):
  - ordinal 22 (`34f5d217-0b6a-48fb-979a-46781a1e9467`, compound, needs_review): Les vrais croyants disent : Ah ! si au moins une sourate descendait d’en haut qui ordonnât la guerre contre les infidèles ! — Mais qu’une sourate péremptoire descende d’en haut, et qu’il y soit parlé de la guerre, tu verras les hommes dont le cœur est atteint d’une infirmité te regarder comme regarde un homme que la vue de la mort fait tomber en défaillance. Cependant l’obéissance et un langage convenable leur siéraient mieux.
  - ordinal 23 (`4cd707e0-932d-4fa4-b88d-5279af661c61`, compound, needs_review): S’ils tenaient leurs engagements envers Dieu quand l’affaire (la guerre) est résolue, cela leur serait plus avantageux.
- **Evidence**: 47:21 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### 65:3

- **Canonical Arabic**: وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ ۚ إِنَّ ٱللَّهَ بَـٰلِغُ أَمْرِهِۦ ۚ قَدْ جَعَلَ ٱللَّهُ لِكُلِّ شَىْءٍ قَدْرًا
- **Contributing segments** (in source_ordinal order):
  - ordinal 2 (`7ce4a007-a0ac-4ec5-9e89-03b1bdbc972f`, compound, needs_review): Lorsqu’elles auront attendu le terme prescrit, vous pouvez, les retenir avec bienveillance ou vous en séparer avec bienveillance. Appelez des témoins équitables, choisis parmi vous ; que le témoignage soit fait devant Dieu. Voilà ce qui est prescrit à ceux qui croient en lui ainsi qu’au jour du jugement. Dieu procurera à celui qui le craint une issue favorable, et le nourrira de dons qu’il ne s’imaginait pas.
  - ordinal 3 (`ee284f8f-8196-4bf3-9768-ddd4a9fed4a1`, compound, needs_review): Dieu suffira à celui qui met sa confiance en lui. Dieu mène ses arrêts à bonne fin. Dieu a assigné un terme à toutes choses.
- **Evidence**: 65:3 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### 65:10

- **Canonical Arabic**: أَعَدَّ ٱللَّهُ لَهُمْ عَذَابًا شَدِيدًا ۖ فَٱتَّقُوا۟ ٱللَّهَ يَـٰٓأُو۟لِى ٱلْأَلْبَـٰبِ ٱلَّذِينَ ءَامَنُوا۟ ۚ قَدْ أَنزَلَ ٱللَّهُ إِلَيْكُمْ ذِكْرًا
- **Contributing segments** (in source_ordinal order):
  - ordinal 10 (`16b64f43-82e8-46f2-ad92-a9d1d9737da2`, compound, needs_review): Dieu leur réserve des châtiments cruels. Craignez le Seigneur, ô hommes doués de sens !
  - ordinal 11 (`7fd90a68-2dac-42a7-8851-7d8e55c0727f`, compound, needs_review): A ceux qui croient, Dieu a envoyé un avertissement, un prophète qui leur récite les enseignements évidents pour faire sortir les croyants et les justes des ténèbres à la lumière. Dieu introduira les croyants et les justes dans les jardins baignés de courants d’eau ; ils y demeureront éternellement. Quelle belle part Dieu réserve au juste !
- **Evidence**: 65:10 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### 106:4

- **Canonical Arabic**: ٱلَّذِىٓ أَطْعَمَهُم مِّن جُوعٍ وَءَامَنَهُم مِّنْ خَوْفٍۭ
- **Contributing segments** (in source_ordinal order):
  - ordinal 3 (`b8afe2bd-9529-4c64-9b8c-6f660055bb2e`, compound, needs_review): Qu’ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de la famine,
  - ordinal 4 (`5faa7684-f879-40fb-a767-f9f163ffbf73`, compound, needs_review): Et qui les a délivrés des alarmes.
- **Evidence**: 106:4 is one of the 8 compound boundary āyahs identified in PHASE1-ALIGNMENT-AUDIT.md §4.6 -- simultaneously a split target and a merge target, so the clean one-classification-per-āyah model breaks down.
- **Reason review needed**: COMPOUND BOUNDARY: this āyah receives content from more than one Kazimirski segment via overlapping split/merge patterns. The exact partition of meaning between the contributing segments is not mechanically decidable and needs an editorial decision by a French-literate reviewer comparing against the canonical Arabic.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

## Tier 3 — Stratified sample of concordance-only surahs (15 of 76 pool, 19.7%)

Sampled surahs: [21, 22, 53, 58, 72, 77, 80, 87, 89, 91, 100, 102, 103, 105, 107]

All 29 muqattaʿat surahs already have a directly-French-verified item 1 (PHASE1-ALIGNMENT-AUDIT.md §4.4) and are therefore NOT in the concordance-only pool -- none needed muqattaʿat-priority promotion into this sample.

### Surah 21 (112 āyahs)

Flagged (split/merge) segments:
  - ordinal 28 (`7b9f5554-c3f0-4dca-a6fa-79f519abf378`, many_to_one) -> 21:28: Il sait tout ce qui est devant eux et derrière eux ; ils ne peuvent intercéder,
  - ordinal 29 (`56c95992-5ab7-4ebe-a8a4-cedefa9364ac`, many_to_one) -> 21:28: Excepté pour celui pour lequel il lui plaît, et ils tremblent de frayeur devant lui.
  - ordinal 67 (`8aae97a5-0224-485d-bc9b-208d5c0620d9`, one_to_many) -> 21:66, 21:67: Adorerez-vous, à côté de Dieu, ce qui ne peut ni vous être utile à rien, ni vous nuire ? Honte sur vous et sur ce que vous adorez à côté de Dieu ! Ne le comprendrez-vous pas ?
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 22 (78 āyahs)

Flagged (split/merge) segments:
  - ordinal 18 (`40755f92-1116-4614-b21a-6ce7e59b2075`, many_to_one) -> 22:18: Ne vois-tu pas que tout ce qui est dans les cieux et sur fa terre adore le Seigneur, le soleil, la lune, les étoiles, les montagnes, les arbres, les animaux et une grande partie des hommes ? Le supplice est déjà résolu pour une grande partie.
  - ordinal 19 (`aa5ad7da-9c20-410c-ac03-3000785c2381`, many_to_one) -> 22:18: Et celui que Dieu rendra méprisable, qui l’honorera ? Dieu fait ce qu’il lui plaît.
  - ordinal 21 (`989e5e1e-9d9f-4f2f-a269-3a409e6a7006`, one_to_many) -> 22:20, 22:21: Leurs entrailles et leur peau en seront consumées ; ils seront frappés de gourdins de fer.
  - ordinal 25 (`8f7fe413-14a0-4907-8032-c9f3236d3d8a`, many_to_one) -> 22:25: Les infidèles sont ceux qui éloignent les autres du chemin de Dieu et de l’oratoire sacré que nous avons établi pour tous les hommes ; ceux qui y résident comme les externes ont un droit égal à le visiter.
  - ordinal 26 (`554e62df-2982-4998-82a8-58def93531ef`, many_to_one) -> 22:25: Et ceux qui voudraient le profaner par méchanceté éprouveront un châtiment douloureux.
  - ordinal 43 (`690018d5-f50a-4cf9-81c5-8956c4deaaed`, one_to_many) -> 22:42, 22:43, 22:44: S’ils t’accusent d’imposture, ô Mohammed ! songe donc qu’avant eux les peuples de Noé, d’Ad, de Thémoud, d’Abraham, de Loth, les Madianites, en accusaient leurs prophètes. Moïse aussi a été traité de menteur. J’ai accordé un long délai aux incrédules, puis je les ai atteints de mon châtiment. Qu’il a été terrible !
  - ordinal 77 (`730eab81-25bd-4545-b0af-e80b50b490ec`, many_to_one) -> 22:78: Combattez pour la cause de Dieu comme il convient de le faire ; il vous a élus. Il ne vous a rien commandé de difficile dans votre religion, dans la religion de votre père Abraham ; il vous a nommés musulmans (qui s’abandonnent à Dieu).
  - ordinal 78 (`40a63e8e-624d-4376-a6bf-6c6ac262c56d`, many_to_one) -> 22:78: Il vous a nommés ainsi bien avant nous et dans ce livre aussi, afin que votre prophète soit témoin contre vous et que vous soyez témoins contre le reste des hommes. Observez donc la prière, faites l’aumône, attachez-vous fermement à Dieu, il est votre patron ; et quel patron et quel protecteur !
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 53 (62 āyahs)

Flagged (split/merge) segments:
  - ordinal 26 (`dd97ad3b-9280-4629-91a4-6a1e72cefeec`, many_to_one) -> 53:26: Que d’anges dans les deux dont l’intercession ne servira de rien,
  - ordinal 27 (`0ae3d0f8-e2c5-47d0-9097-a39dbc5e8338`, many_to_one) -> 53:26: Sauf, si Dieu permet d’intercéder, à celui qu’il voudra, à celui qu’il lui plaira.
  - ordinal 58 (`92476db5-8853-4b28-abcd-3fa2a22e5987`, one_to_many) -> 53:57, 53:58: L’heure qui doit venir approche, et point de remède contre elle, excepté en Dieu.
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 58 (22 āyahs)

Flagged (split/merge) segments:
  - ordinal 2 (`82524666-ccfd-4b68-b348-ca6a9da51cd0`, many_to_one) -> 58:2: Ceux d’entre vous qui répudient leurs femmes en disant qu’ils les regarderont comme leurs mères (elles ne sont pas leurs mères ; leurs mères sont celles qui les ont enfantés), profèrent une parole blâmable et une fausseté.
  - ordinal 3 (`20b704c8-9ef0-4a3b-afc9-813e25e83e2f`, many_to_one) -> 58:2: Certes, Dieu est porté au pardon et à l’indulgence,
  - ordinal 21 (`bdab7613-5375-4696-a2e4-96ce37704d3b`, one_to_many) -> 58:20, 58:21: Ceux qui luttent contre Dieu et le prophète seront livrés au mépris. Dieu a écrit d’avance cet arrêt : J’aurai le dessus et mes envoyés aussi. Dieu est fort et puissant.
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 72 (28 āyahs)

Flagged (split/merge) segments:
  - ordinal 22 (`40220ff5-9883-4880-92be-afd70cfc173a`, many_to_one) -> 72:22: Dis-leur : Personne ne saurait me protéger contre Dieu.
  - ordinal 23 (`cccc44cb-21a8-4e2b-bb6b-ab14aecd1c09`, many_to_one) -> 72:22: En dehors de Dieu je ne trouverai point de refuge.
  - ordinal 26 (`7628a5b7-08cb-4811-87d6-693476f52755`, one_to_many) -> 72:25, 72:26: Dis-leur : J’ignore si les peines dont vous êtes menacés sont proches, ou bien si Dieu leur a assigné un terme éloigné. Dieu seul connait les choses cachées et il ne les dévoile à personne,
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 77 (50 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 80 (42 āyahs)

Flagged (split/merge) segments:
  - ordinal 15 (`9d54d3e9-3d4c-4cea-96f6-60e2cd5733d2`, one_to_many) -> 80:15, 80:16: Tracé par les mains des écrivains honorés et justes.
  - ordinal 18 (`5d5f62fb-d4af-423d-aa15-78ac7ce06010`, many_to_one) -> 80:19: D’une goutte de sperme.
  - ordinal 19 (`a0860b8c-defb-4db2-9e3a-9fea1a97142b`, many_to_one) -> 80:19: Il l’a créé et l’a façonné d’après certaines proportions.
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 87 (19 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 89 (30 āyahs)

Flagged (split/merge) segments:
  - ordinal 1 (`ab0fccb4-68d5-4563-922b-6bd48261fc7a`, one_to_many) -> 89:1, 89:2: J’en jure par LE POINT DU JOUR et les dix nuits,
  - ordinal 14 (`5b315119-3820-41fd-8c54-f87b09a984d8`, many_to_one) -> 89:15: Quand, pour éprouver l’homme, Dieu le comble de bienfaits,
  - ordinal 15 (`54f7d03b-69d0-4d7d-870f-33b932ac1b8e`, many_to_one) -> 89:15: L’homme dit : Le Seigneur m’a témoigné des égards.
  - ordinal 16 (`b0fc84f5-cec6-48ac-9117-b21c8dbdc283`, many_to_one) -> 89:16: Mais que Dieu, pour l’éprouver, lui mesure ses dons,
  - ordinal 17 (`f795e111-0380-4757-8a6b-4127c92aac73`, many_to_one) -> 89:16: L’homme s’écrie : Le Seigneur m’a fait un affront !
  - ordinal 25 (`b7862189-3280-44fc-9b0f-b75f6864c0bb`, one_to_many) -> 89:24, 89:25: Il s’écrira : Plût à Dieu que j’eusse fait le bien durant ma vie ! Ce jour-là, nul ne saurait punir comme Dieu.
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 91 (15 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 100 (11 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 102 (8 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 103 (3 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 105 (5 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_

### Surah 107 (7 āyahs)

Flagged (split/merge) segments: _none — every item in this surah is a plain direct/offset mapping_
- **Evidence**: PHASE1-ALIGNMENT-AUDIT.md §0.3: this surah's classification rests on the 3-way concordance cross-validation (Kazimirski's own header count vs. Flügel; Flügel-column Cairo count vs. canonical; PDF's own summary stats), not on an individual French-text read against a canonical French Quran reference.
- **Reason review needed**: STRATIFIED SAMPLE: part of a >=15-20% sample of the ~74 concordance-only surahs (PHASE1-ALIGNMENT-AUDIT.md §0.3/§7), selected by ayah-count tercile (short/medium/long) to give the reviewer representative coverage rather than an arbitrary first-N. Only this surah's split/merge (one_to_many/many_to_one/compound) segments are listed -- its plain direct/offset items carry no elevated review value. This surah has ZERO split/merge segments -- every item is a plain direct/offset (A/B) mapping; included here for stratified-sample completeness, not because any specific item looks doubtful.
- **Reviewer decision**: _(blank)_
- **Reviewer notes**: _(blank)_
