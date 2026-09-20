# Level 6 Batch 1 — Owner Review Checklist

**Owner editorial review only. No qualified Islamic-studies review or
independent professional French review was obtained. AI analysis was
advisory and does not constitute human scholarly approval.**

| Field | Value |
|---|---|
| Owner | Moubarak Akamou |
| Role | QuranRoots product owner |
| English review scope | All English learner-facing strings, exercises, and correct answers in this batch (below) |
| French review scope | All French learner-facing strings, exercises, and correct answers in this batch (below) |
| Date | 2026-09-20 |
| Exact reviewed commit SHA | `db80b85` (branch `feat/level6-owner-reviewed-reduced-scope`) — the reviewable content (migration, tests) is exactly as committed there; this field was filled in by a small follow-up, documentation-only commit, since a commit cannot reference its own SHA |
| Explicit approval or requested corrections | *(to be filled in by the owner after reading this document)* |

The owner is not a scholar, theologian, certified translator, or
independent reviewer, and this document does not describe them as one.
This is a reduced-scope, owner-controlled release path chosen instead of
external qualified review (see "Governance history" below) — not a
substitute for one. Level 6 remains disabled (no `STEP_LEVEL_SLUGS.
surah_mastery` activation wiring) and its migration remains unapplied to
production regardless of what this document records.

---

## Governance history (for context, not a decision point)

1. PR #31 merged this content to `main` prematurely, before any qualified
   human review (`5b50be3`).
2. A follow-up change removed the activation wiring and confirmed the
   migration was never applied to production (`1d4f865`/`0646044`, PR #32)
   — no unapproved lesson content was ever served to a learner.
3. Two independent, adversarial **AI** reviews and a reconciliation pass
   found and applied narrow, non-interpretive corrections (terminology
   consistency, presupposition removal) — see `LEVEL6-AI-REVIEW-A-QURAN-
   CONTENT.md`, `LEVEL6-AI-REVIEW-B-FRENCH.md`,
   `LEVEL6-AI-REVIEW-RECONCILIATION.md`. These are AI analysis, not human
   approval, and are not treated as such anywhere in this project.
4. Candidate qualified human reviewers were researched (real people,
   independently verified) and two were selected and their outreach fully
   prepared, but never sent. **The owner then decided not to contact
   external scholars or French reviewers at all**, and requested this
   reduced-scope, owner-reviewable path instead. That outreach research
   and the prepared (unsent) drafts are preserved for historical
   transparency in `LEVEL6-REVIEWER-OUTREACH-DRAFTS.md`, now marked
   cancelled — no reviewer was ever contacted, no institution or publisher
   was contacted, and no personal contact information from that research
   is repeated in this document.
5. This document and the migration edits it describes are the direct
   result of that decision: every claim previously flagged as disputed,
   interpretive, or requiring a qualified reviewer's judgment has been
   removed, replaced with neutral/objective wording, or explicitly
   deferred — never decided by picking a side of a scholarly disagreement.

---

## Classification key (applied to every claim below)

- **Quote** — direct quotation from the app's own displayed, governed
  translation text (`ayahs.translation_en`/`translation_fr`)
- **Structural** — objective structural observation (verse order, which
  ayah a section discusses)
- **Linguistic** — basic linguistic observation directly supported by the
  displayed text or a cited source (grammatical person, an imperative verb
  form actually present in the translation)
- **Interpretive/doctrinal** — an interpretive or doctrinal claim (none
  remain unaddressed below — every instance found was removed, neutralized,
  or explicitly deferred, as recorded in the "Removed or neutralized"
  table)
- **Editorial** — pedagogical/editorial guidance with no religious content
  claim (tips, summaries restating already-classified material)
- **Unsupported/ambiguous** — flagged and fixed where found (the exercise-
  wording items below)

---

## Removed or neutralized interpretive claims — before/after table

Every instance where this batch previously extended a "praise"
categorization to include ayah 4 (the specific point of scholarly
disagreement — see Sources below) has been reworded to the objective,
undisputed grammatical fact both named sources agree on: ayat 1 through 4
describe Allah in the third person. No claim is made anywhere in the
corrected text about whether ayah 4 specifically counts as "praise" or as
"transitional" — that question is **deferred**, not decided.

| # | File / migration location | Original wording (EN) | Original wording (FR) | New wording (EN) | New wording (FR) | Classification (after) |
|---|---|---|---|---|---|---|
| 1 | Lesson 1, section 2 (explanation) | "Ayat 1 to 4 **praise** Allah, naming who He is." | "Les versets 1 à 4 **louent** Allah, en disant qui Il est." | "Ayat 1 to 4 **describe** Allah, naming who He is." | "Les versets 1 à 4 **décrivent** Allah, en disant qui Il est." | Linguistic |
| 2 | Lesson 1, section 3 (summary) | "Two parts, seven ayat: **praise** (1-4), then request (5-7)..." | "...**louange** (1 à 4), puis demande (5 à 7)..." | "Two parts, seven ayat: **description** (1-4), then request (5-7)..." | "...**description** (1 à 4), puis demande (5 à 7)..." | Linguistic |
| 3 | Lesson 1, exercise 1 (true/false prompt) | "Ayat 1 to 4 **praise and describe** Allah; ayat 5 to 7 turn to a direct request." | "Les versets 1 à 4 **louent et décrivent** Allah ; les versets 5 à 7 se tournent vers une demande directe." | "Ayat 1 to 4 **describe** Allah **in the third person**; ayat 5 to 7 turn to **address Him directly with** a request." | "Les versets 1 à 4 **décrivent** Allah **à la troisième personne** ; les versets 5 à 7 **s'adressent directement à Lui avec une demande**." | Linguistic |
| 4 | Lesson 1, exercise 1 (true/false explanation) | "That is Al-Fatiha's shape: first **praise**, then petition." | "...d'abord la **louange**, puis la demande." | "That is Al-Fatiha's shape: first **description**, then request." | "...d'abord la **description**, puis la demande." | Editorial |
| 5 | Lesson 1, exercise 2 (matching, right-hand value only — the review-item key on the left, `"Ayat 1-4"`/`"Versets 1 à 4"`, is unchanged) | `"right": "**Praise**: naming who Allah is"` | `"right": "**Louange** : dire qui est Allah"` | `"right": "**Description**: naming who Allah is"` | `"right": "**Description** : dire qui est Allah"` | Linguistic |
| 6 | Lesson 2, section 2 (ayah 4 `quran_example`) — **the most direct instance of the disputed claim** | "...adds a new description: Allah's authority specifically on the Day of Judgment. **It is still praise, still describing** Allah in the third person, like ayat 1 through 3." | "...C'est **encore de la louange**, Allah étant toujours décrit à la troisième personne, comme dans les versets 1 à 3." | "...adds a new description: Allah's authority specifically on the Day of Judgment. **Like ayat 1 through 3, it describes** Allah in the third person." | "...**Comme les versets 1 à 3, il décrit** Allah à la troisième personne." | Linguistic |

**What was deliberately left unchanged** (and why): every place "praise"/
"louange" is used only as a loose, whole-surah-level gloss for the general
arc — the module goal, Lesson 3's title, and several summary/tip lines —
was left as-is. Both named sources describe the surah's *overall* movement
this same way (Darul Iftaa Birmingham's own words: "the first three are in
praise of Allah... the last three [are] a request"), so this broad framing
is not the disputed part; only the specific ayah-4 boundary claim was, and
that is what changed above. Similarly, "praise" applied specifically and
only to ayat 1–3 (never extending to ayah 4) was left unchanged — e.g.
Lesson 2's summary "Ayah 3 repeats Allah's mercy as praise" and the Lesson
2 matching exercise's "Repeats ayah 1's praise as its own ayah" — because
ayat 1–3 being praise is not disputed by either named source and the word
"praise" literally appears in ayah 2's own displayed translation ("[All]
praise is [due] to Allah").

## Second neutralized item: the Lesson 3 "concrete" exercise-wording ambiguity

| File / location | Original (EN) | Original (FR) | New (EN) | New (FR) | Classification |
|---|---|---|---|---|---|
| Lesson 3, exercise 0 (multiple-choice prompt) | "Which ayah first **makes the request concrete** -- what exactly are we asking Allah to show us?" | "Quel verset **rend la demande concrète** pour la première fois — que demandons-nous exactement à Allah de nous montrer ?" | "Which ayah first **names the specific request** -- what exactly are we asking Allah for?" | "Quel verset **nomme en premier la demande précise** — que demandons-nous exactement à Allah ?" | Unsupported/ambiguous → fixed |

This was not a doctrinal question: the tip section (Lesson 3, section 2)
and the very next exercise both use "concrete" for ayah 7's contrast; this
exercise incorrectly reused the same word for ayah 6, creating a real,
non-doctrinal reason for a learner to answer "Ayah 7" and be marked wrong.
Same choices, same correct answer (Ayah 6), same tested knowledge — only
the ambiguous word was removed. "Concrete"/"concret" now refers
exclusively and consistently to ayah 7 everywhere else in the lesson.

## Deliberately deferred, not decided

| Item | Why it's deferred, not resolved |
|---|---|
| Whether ayah 4 itself is "praise" or "transitional" | Genuine scholarly disagreement (Sahih Muslim 395 supports one reading; Darul Iftaa Birmingham another) — see Sources. Not decided here; the disputed *classification* of ayah 4 was removed rather than resolved in either direction. |
| "Evoked" (ayah 1:7) vs. the live public API's current "earned" | Not a doctrinal question — an edition/printing variance. **Kept as "evoked"**, matching exactly what `ayahs.translation_en` stores and what the learner actually sees on screen (the displayed data itself is the source; changing the lesson's word without changing what's displayed would make the lesson describe text the learner cannot see). Which print edition (1997 vs. 2004) `ayahs.translation_en` reflects remains an open, unconfirmed data-provenance question — recorded, not resolved. |
| `quran_example` sections show no translator/edition attribution anywhere in the UI | Systemic, cross-level characteristic (every lesson, every level) — not something this batch introduces or can fix unilaterally. |
| Kazimirski French translation never rendering for these sections, in any environment | A pre-existing code-wiring gap (`LessonSectionRenderer.tsx` never calls the governed French resolver for `quran_example` sections), not a Level 6 content defect and not fixable inside a content-only pass. |

---

## Sources cited

| Source | Used for |
|---|---|
| `ayahs.translation_en`/`translation_fr` (this app's own database, read directly, not assumed) | Every direct quotation in the lessons; the ground truth for what a learner actually sees |
| Sahih Muslim 395 (hadith, Abu Hurayrah; hadeethenc.com, Encyclopedia of Translated Prophetic Hadiths, graded Authentic) | The praise/petition division as a broad description of the surah's structure (kept); does *not* by itself settle ayah 4's specific classification |
| Darul Iftaa Birmingham (Hanafi), "Tafsir of Surah Fatiha" (IslamQA) | The alternate framing treating ayah 4 as transitional — the reason ayah 4's specific classification was removed rather than asserted |
| Yaqeen Institute / Dr. Nazir Khan | The grammatical third-to-second-person shift at ayah 5 — a plain, independently observable grammatical fact, unaffected by this reduction |
| `api.quran.com` v4, translation resource 20 (Saheeh International) | Cross-check confirming "evoked" vs. the live API's "earned" is the only wording difference across all 7 ayat |
| Wikipedia, Al-Fatiha / root *f-t-ḥ* | "The Opening" as the standard translation of the surah's name (unchanged, uncontested) |

Full citation detail and method: `LEVEL6-RESEARCH-REVIEW.md`.

---

## Complete current content (post-reduction), for direct review

*(Every string below is quoted verbatim from
`supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`
at the commit this document ships with — not summarized or paraphrased.)*

### Module

- title_en: "Al-Fatiha: A Complete Surah" · title_fr: "Al-Fatiha : une sourate complète" — Editorial
- goal_en: "Study Al-Fatiha as one complete surah, tracing how its meaning builds from praise to petition." · goal_fr: "Étudier Al-Fatiha comme une sourate complète, en suivant comment son sens se construit, de la louange à la demande." — Editorial (whole-surah gloss, both sources agree; not ayah-4-specific)

### Lesson 1 — "Al-Fatiha: The Complete Surah" / "Al-Fatiha : la sourate complète"

**Sections**
- S0 (explanation) EN: "You have already read all seven ayat of Al-Fatiha aloud, and in Level 5 you recognized several of its grammatical particles. Now you study it as what it is: one complete surah, read and understood as a whole rather than as separate practice lines." FR: "Vous avez déjà lu à voix haute les sept versets d'Al-Fatiha, et au Niveau 5 vous en avez reconnu plusieurs particules grammaticales. Vous l'étudiez maintenant telle qu'elle est : une sourate complète, lue et comprise dans son ensemble plutôt que comme des lignes d'exercice séparées." — Structural
- S1 (`quran_example` 1:1) EN: "Al-Fatiha -- 'The Opening' -- begins here, with the same ayah that opens the Qur'an itself." FR: "Al-Fatiha — « l'Ouverture » — commence ici, avec le même verset qui ouvre le Coran lui-même." — Quote/Structural
- S2 (explanation) EN: "Read together, Al-Fatiha's seven ayat fall into two parts. Ayat 1 to 4 describe Allah, naming who He is. Ayat 5 to 7 turn to a direct request. The turn happens at 'You' in ayah 5 -- the first time the surah speaks directly to Allah instead of describing Him." FR: "Lus ensemble, les sept versets d'Al-Fatiha se divisent en deux parties. Les versets 1 à 4 décrivent Allah, en disant qui Il est. Les versets 5 à 7 se tournent vers une demande directe. Le tournant se produit à « Toi » dans le verset 5 — la première fois que la sourate s'adresse directement à Allah au lieu de Le décrire." — Linguistic (reduced, see table above)
- S3 (summary) EN: "Two parts, seven ayat: description (1-4), then request (5-7), turning at ayah 5." FR: "Deux parties, sept versets : description (1 à 4), puis demande (5 à 7), le tournant se situant au verset 5." — Linguistic (reduced)

**Exercises**
- E0 (multiple_choice) Prompt EN: "Which ayah is the first to address Allah directly as 'You', rather than describing Him in the third person?" FR: "Quel est le premier verset à s'adresser directement à Allah par « Toi », plutôt que de Le décrire à la troisième personne ?" Choices EN: Ayah 2 / Ayah 4 / Ayah 5 (FR: Verset 2 / Verset 4 / Verset 5). **Correct: Ayah/Verset 5.** Explanation EN: "Ayat 1-4 describe Allah in the third person ('Lord of the worlds', 'Sovereign of the Day of Recompense'). Ayah 5 shifts to speaking directly to Him." FR: "Les versets 1 à 4 décrivent Allah à la troisième personne (« Seigneur des mondes », « Maître du Jour de la rétribution »). Le verset 5 passe à s'adresser à Lui directement." — Linguistic
- E1 (true_false) Prompt EN: "Ayat 1 to 4 describe Allah in the third person; ayat 5 to 7 turn to address Him directly with a request." FR: "Les versets 1 à 4 décrivent Allah à la troisième personne ; les versets 5 à 7 s'adressent directement à Lui avec une demande." **Correct: True.** Explanation EN: "That is Al-Fatiha's shape: first description, then request." FR: "C'est la structure d'Al-Fatiha : d'abord la description, puis la demande." — Linguistic (reduced)
- E2 (matching) Prompt EN: "Match each part of Al-Fatiha to what it does." FR: "Associez chaque partie d'Al-Fatiha à ce qu'elle fait." Pairs EN: "Ayat 1-4" → "Description: naming who Allah is" / "Ayat 5-7" → "Request: asking Allah directly" / "The turning word" → "'You', in ayah 5". FR: "Versets 1 à 4" → "Description : dire qui est Allah" / "Versets 5 à 7" → "Demande : s'adresser directement à Allah" / "Le mot du tournant" → "« Toi », au verset 5". — Linguistic (reduced)

### Lesson 2 — "Tracing Meaning, Ayah by Ayah" / "Suivre le sens, verset par verset"

**Sections**
- S0 (explanation) EN: "Ayah 3 has never been studied for its meaning before now. Ayah 4 and ayah 6 had their individual phrases explained already, in Level 4's grammar lessons -- but not how they fit into Al-Fatiha's own arc, from praise to request. That is what you trace here." FR: "Le verset 3 n'avait encore jamais été étudié pour son sens. Les versets 4 et 6 ont déjà eu leurs expressions expliquées, dans les leçons de grammaire du Niveau 4 — mais pas la façon dont ils s'inscrivent dans la trajectoire propre d'Al-Fatiha, de la louange à la demande. C'est ce que vous allez suivre ici." — Structural (whole-surah gloss retained)
- S1 (`quran_example` 1:3) EN: "Ayah 3 repeats the same two names for Allah that closed ayah 1 -- 'the Entirely Merciful, the Especially Merciful' -- this time as its own complete ayah." FR: "Le verset 3 reprend les deux mêmes noms d'Allah qui clôturaient le verset 1 — « le Tout Miséricordieux, le Très Miséricordieux » — cette fois comme un verset à part entière." — Quote/Structural
- S2 (`quran_example` 1:4) EN: "Ayah 4 -- 'Sovereign of the Day of Recompense' -- adds a new description: Allah's authority specifically on the Day of Judgment. Like ayat 1 through 3, it describes Allah in the third person." FR: "Le verset 4 — « Maître du Jour de la rétribution » — ajoute une nouvelle description : l'autorité d'Allah, en particulier au Jour du Jugement. Comme les versets 1 à 3, il décrit Allah à la troisième personne." — Linguistic (reduced, see table above — the most direct instance of the disputed claim, now fixed)
- S3 (`quran_example` 1:6) EN: "Ayah 6 -- 'Guide us to the straight path' -- is the request the surah has been building toward since ayah 5. It is the specific thing being asked for." FR: "Le verset 6 — « Guide-nous vers le droit chemin » — est la demande vers laquelle la sourate se dirigeait depuis le verset 5. C'est la chose précise qui est demandée." — Quote/Linguistic
- S4 (summary) EN: "Ayah 3 repeats Allah's mercy as praise. Ayah 4 adds His authority on the Day of Judgment. Ayah 6 names the request itself: guidance to the straight path." FR: "Le verset 3 reprend la miséricorde d'Allah comme louange. Le verset 4 ajoute Son autorité au Jour du Jugement. Le verset 6 nomme la demande elle-même : être guidé sur le droit chemin." — Linguistic ("praise" here is scoped to ayah 3 only, undisputed — see "what was left unchanged" above)

**Exercises**
- E0 (multiple_choice) Prompt EN: "What does ayah 4 add to the surah's description of Allah?" FR: "Qu'ajoute le verset 4 à la description d'Allah dans la sourate ?" Choices: "A new name for Allah" / "His authority over the Day of Judgment" / "A request for guidance" (FR: "Un nouveau nom pour Allah" / "Son autorité sur le Jour du Jugement" / "Une demande d'être guidé"). **Correct: His authority over the Day of Judgment.** Explanation EN: "Ayah 4 names Allah 'Sovereign of the Day of Recompense' -- still describing Him, not yet a request." FR: "Le verset 4 nomme Allah « Maître du Jour de la rétribution » — Le décrivant encore, pas encore une demande." — Linguistic
- E1 (true_false) Prompt EN: "Ayah 6, 'Guide us to the straight path', is the central request the rest of the surah builds toward." FR: "Le verset 6, la demande d'être guidé sur le droit chemin, est la demande centrale vers laquelle le reste de la sourate se dirige." **Correct: True.** — Linguistic
- E2 (matching) Prompt EN: "Match each ayah to what it does." FR: "Associez chaque verset à ce qu'il fait." Pairs EN: "Ayah 3" → "Repeats ayah 1's praise as its own ayah" / "Ayah 4" → "Allah's authority on the Day of Judgment" / "Ayah 6" → "The request for guidance". FR: "Verset 3" → "Reprend la louange du verset 1 comme verset à part entière" / "Verset 4" → "L'autorité d'Allah au Jour du Jugement" / "Verset 6" → "La demande d'être guidé". — Linguistic ("praise"/"louange" here scoped to ayah 3/ayah 1, undisputed)

### Lesson 3 — "Synthesis: From Praise to Petition" / "Synthèse : de la louange à la demande" (capstone)

**Sections**
- S0 (explanation) EN: "Put together, Al-Fatiha moves in one direction: praise, then request, then a request made concrete. Ayat 1 to 4 say who Allah is. Ayah 5 turns to address Him directly and states why: worship and a need for help. Ayah 6 names the request: guidance. Ayah 7 makes that guidance concrete, by contrast." FR: "Pris dans son ensemble, Al-Fatiha avance dans une seule direction : la louange, puis la demande, puis une demande rendue concrète. Les versets 1 à 4 disent qui est Allah. Le verset 5 se tourne pour s'adresser à Lui directement et en donne la raison : l'adoration et le besoin d'aide. Le verset 6 nomme la demande : être guidé. Le verset 7 rend cela concret, par contraste." — Structural (whole-surah gloss retained; "Ayat 1 to 4 say who Allah is" was already neutral)
- S1 (`quran_example` 1:7) EN: "The path is described by contrast: the path of those Allah has bestowed favor upon, not the path of those who have evoked anger or gone astray. The request in ayah 6 becomes specific here." FR: "Le chemin est décrit par contraste : le chemin de ceux qu'Allah a comblés de Ses faveurs, non celui de ceux qui ont encouru Sa colère ou qui se sont égarés. La demande du verset 6 se précise ici." — Quote/Structural ("evoked"/"encouru" deliberately kept, see Deferred table)
- S2 (tip) EN: "Notice the build: praise (who Allah is) leads to worship and a request for help (why we turn to Him), which leads to guidance (what we ask for), made concrete by the path's contrast (ayah 7)." FR: "Remarquez la construction : la louange (qui est Allah) mène à l'adoration et à une demande d'aide (pourquoi nous nous tournons vers Lui), qui mène à la demande d'être guidé (ce que nous demandons), rendue concrète par le contraste du chemin (verset 7)." — Editorial (whole-surah gloss retained)
- S3 (summary) EN: "Seven ayat, one direction: praise, then worship and help, then guidance, then the path itself." FR: "Sept versets, une seule direction : la louange, puis l'adoration et l'aide, puis le fait d'être guidé, puis le chemin lui-même." — Editorial (whole-surah gloss retained)

**Exercises** (capstone: no matching exercises, zero new review items)
- E0 (multiple_choice) Prompt EN: "Which ayah first names the specific request -- what exactly are we asking Allah for?" FR: "Quel verset nomme en premier la demande précise — que demandons-nous exactement à Allah ?" Choices: Ayah/Verset 5 / 6 / 7. **Correct: Ayah/Verset 6.** — Linguistic (reduced, see table above)
- E1 (true_false) Prompt EN: "Ayah 7 makes the 'straight path' of ayah 6 concrete by contrasting it with two other paths." FR: "Le verset 7 rend concret le « droit chemin » du verset 6 en le mettant en contraste avec deux autres chemins." **Correct: True.** Explanation EN: "Ayah 7 contrasts the favored path with two others: the path of those who have evoked anger, and the path of those who have gone astray." FR: "Le verset 7 met en contraste le chemin des favorisés avec deux autres : le chemin de ceux qui ont encouru la colère, et le chemin de ceux qui se sont égarés." — Linguistic
- E2 (multiple_choice) Prompt EN: "Put Al-Fatiha's movement in order: (A) the request for guidance, (B) praise of Allah as Lord of the worlds, (C) the path described by contrast." FR: "Remettez le mouvement d'Al-Fatiha dans l'ordre : (A) la demande d'être guidé, (B) la louange d'Allah en tant que Seigneur des mondes, (C) le chemin décrit par contraste." Choices: "B, A, C" / "A, B, C" / "C, B, A". **Correct: B, A, C.** — Editorial ("praise" here scoped to ayah 2's own content, undisputed)

---

## Exercise-type and preferred-question-shape audit

Per the request to prefer questions testing recognition of displayed
text, verse order, speaker/addressee transitions, established vocabulary,
and relationships explicitly stated in the translation: all 9 exercises
in this batch already fit this shape after the reductions above --
grammatical person (E0/E1 in Lesson 1), verse-content matching (matching
exercises), which ayah supplies specific content (Lesson 2 E0/E1), and
movement/order (Lesson 3 E2) are all directly checkable against the
displayed translation text with zero remaining interpretive content. No
exercise was found needing removal entirely.

---

## Unresolved decisions requiring the owner's explicit input

1. Whether the reduced wording above is acceptable, or whether the owner
   wants different neutral phrasing.
2. Whether to also neutralize the whole-surah-level "praise to petition"
   gloss (module goal, Lesson 3 title, several summary/tip lines) that
   this pass left unchanged as broadly source-supported — see "What was
   deliberately left unchanged" above.
3. The four items in "Deliberately deferred, not decided" above — none
   of these were resolved by this pass, and resolving them would require
   either qualified review (still not being sought) or a separate,
   explicit owner decision to accept a specific tradeoff.
4. Whether the migration should ever be applied to production, and if so,
   when, and under what activation plan — entirely separate from and
   subsequent to this document.

---

## Exact file and migration locations

- Content: `supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`
- Regression tests: `tests/e2e/58-level6-batch1-al-fatiha-surah-study.spec.ts`
  (new test added: "the disputed 'ayah 4 is still praise' claim and the
  ayah-6/7 'concrete' ambiguity are not present, in English or French")
- Activation wiring (confirmed absent): `src/lib/placement.ts`,
  `STEP_LEVEL_SLUGS` map
- Ledger: `LEVEL6-CONTENT-LEDGER.md`
- Research: `LEVEL6-RESEARCH-REVIEW.md`
- AI reviews (advisory only): `LEVEL6-AI-REVIEW-A-QURAN-CONTENT.md`,
  `LEVEL6-AI-REVIEW-B-FRENCH.md`, `LEVEL6-AI-REVIEW-RECONCILIATION.md`
- Cancelled outreach record: `LEVEL6-REVIEWER-OUTREACH-DRAFTS.md`
