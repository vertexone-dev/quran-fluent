# Level 6 Batch 1 — Content source ledger and human-review record

**Status: UNREVIEWED. Not approved. Not deployed. Not live.** This document
records what was authored, exactly what it is grounded in, and exactly what
still needs a qualified human content reviewer's sign-off before the
migration it describes (`supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`)
may be applied to production. Nothing in this document constitutes that
approval. See `LEVEL6-SURAH-MASTERY-PLAN.md` for the original design
proposal this batch implements the first module of.

Branch: `feat/level6-surah-mastery-candidate`, based on `main` @ `b5b4f75`.

---

## 1. Scope of this batch

One module, three lessons, under the existing `levels.number = 6` row
(`slug = 'quranic-comprehension'`, unchanged — see §5.1 for why the slug was
not renamed). Surah: **Al-Fatiha (1)**, all seven ayat. No other level,
no other surah, no progress/placement/auth/payment table, and no governed
Qur'an text or translation row is touched.

| Lesson slug | Title (en) | Ayat used | New review items |
|---|---|---|---|
| `al-fatiha-orientation-and-structure` | Al-Fatiha: The Complete Surah | 1:1 (re-anchor) | 1 matching exercise → 3 `concept` items |
| `al-fatiha-tracing-meaning` | Tracing Meaning, Ayah by Ayah | 1:3, 1:4, 1:6 | 1 matching exercise → 3 `concept` items |
| `al-fatiha-synthesis-praise-and-petition` (capstone) | Synthesis: From Praise to Petition | 1:7 | 0 (capstone — no `matching` exercises, per established Level 3/4/5 capstone precedent) |

---

## 2. Why Al-Fatiha, and why this doesn't duplicate Levels 1 or 5

Confirmed by direct inspection of the actual migration SQL and E2E specs
(not assumed from the design doc):

- **Level 1 Module 8** (`reading-al-fatiha`, `supabase/migrations/20260901100000_53bb24f4-991d-4399-816f-d5641f045dc0.sql`)
  reads all seven ayat aloud. Its own header states its boundary explicitly:
  "no grammar/morphology explanation ..., and no religious
  interpretation/tafsīr beyond the surah's already-governed translation
  text." All 14 of its exercises test pronunciation/decoding
  (`reading_check`) or a surface textual fact (repetition, marks, word
  count) — never meaning. This batch does not repeat any of those exact
  facts and does not add any `reading_check` exercise.
- **Level 5** (`guided-ayah-comprehension`) uses only 4 of Al-Fatiha's 7
  ayat (1:1, 1:2, 1:5, 1:7), each as a one-sentence grammatical cameo
  illustrating an attached/independent particle (*wa-*, *al-*, *bi-*,
  *ʿalā*) — never the lesson's subject, never meaning, never ayat 1:3/1:4/1:6.
  Its own migration header (`supabase/migrations/20260910100000_1878db2f-7b0e-4433-8393-3d27b0e23294.sql:21-23`)
  explicitly reserves Al-Fatiha's fuller treatment for "a future
  'surah_mastery' batch" — i.e., this one.
- **Whole-surah, cross-ayah meaning synthesis has no precedent anywhere in
  the stored curriculum**, for any surah. The closest analog (Level 5's
  Al-Kawthar capstone) is a grammar-category roll-call across 3 ayat, not
  thematic synthesis of what a passage communicates as a whole.
- Ayat **1:3, 1:4, and 1:6 have never been used for their meaning anywhere**
  in the curriculum before this batch (1:4 and 1:6 got one-word
  orthography-spotting cameos in Level 1 Modules 4/6; 1:3 has never been
  used for anything beyond the Module 8 read-aloud pass). This batch's
  Lesson 2 is built specifically around these three.
- This batch does **not** re-explain *wa-*/*al-*/*bi-*/*ʿalā* (Level 5's
  territory) — Lesson 1 and Lesson 2 reference the learner's prior Level 1
  reading and Level 5 particle recognition only as already-known context,
  never re-teaching it.

---

## 3. Source ledger — every ayah and claim used

**Correction made during authoring, recorded here rather than silently
fixed**: an earlier draft of this batch (and an earlier draft of this
ledger) quoted the separate, normalized `public.translations` table's
`pickthall-gutenberg-16955` row for each ayah. That row is real and
`verification_status = 'verified'`, but it is **not** what actually renders
on screen — `LessonSectionRenderer`'s `quran_example` handling calls
`fetchAyah`/`ayahTranslation`, which reads the legacy `ayahs.translation_en`
column, populated by a different, earlier-imported edition (Sahih
International, edition `en.sahih`, per migration `20260818042151`'s own
header). This was caught by this batch's own E2E test (§ below) failing
against the real rendered text, not by re-reading the schema more
carefully — a concrete example of why the delivery gates matter even for
content work. Every quote below has been corrected and re-verified against
a live `select ayah_number, translation_en from ayahs where surah_number =
1` query against local Supabase, not against the `translations` table.

Every claim below is grounded in one of exactly two things: (a) the
existing `ayahs.translation_en` text for that ayah — the Sahih
International wording actually shown by every `quran_example` section in
this app, quoted verbatim where directly quoted — or (b) a
structural/compositional observation about the surah's own English text
(3rd-person vs. 2nd-person address; which ayah introduces a request; what a
given ayah's own translation names or contrasts). No claim in this batch
relies on any tafsir, hadith, or external interpretive source. No canonical
Arabic text is hand-typed anywhere — every `quran_example` section is a
`(surah_number, ayah_number)` foreign-key reference into the existing
`ayahs` table, rendered by the app's existing `fetchAyah`/
`QuranExampleSection` machinery, exactly like every prior level's lessons.

**Note on this legacy source's own governance status**: `ayahs.translation_en`
predates this project's `content_sources`/`translations` governance
framework (added later, currently covering only Pickthall as `verified`)
and has no `content_sources` row of its own tracking edition/verification
status. It is nonetheless the text every learner actually sees in every
lesson's `quran_example` blocks, in every level, today — this is a
pre-existing, systemic characteristic of the app this batch inherits and
does not change, not something introduced here. Worth a reviewer's
attention as a separate governance question (is `en.sahih` correctly and
completely attributed anywhere in the UI?), distinct from this batch's own
content accuracy.

| Ayah | Actual rendered English text (`ayahs.translation_en`, Sahih International) | Claim made in this batch | Grounding |
|---|---|---|---|
| 1:1 | "In the name of Allah, the Entirely Merciful, the Especially Merciful." | Re-anchoring reference only (Lesson 1); no new claim. | N/A |
| 1:2 | "[All] praise is [due] to Allah, Lord of the worlds -" | Referenced in prose (Lesson 1) as part of the "praise, 3rd person" observation. | Direct reading of the translation's own grammatical person. |
| 1:3 | "The Entirely Merciful, the Especially Merciful," | Repeats ayah 1's closing description as its own ayah of praise. | Direct textual comparison of the two rows — the repetition itself is already an established curriculum fact (Level 1 Module 8's own `true_false` exercise); this batch only extends it into a meaning statement, not a new factual claim. |
| 1:4 | "Sovereign of the Day of Recompense." | Adds Allah's authority "on the Day of Judgment" to the praise; still 3rd person. | Direct paraphrase of the rendered text's own wording. |
| 1:5 | "It is You we worship and You we ask for help." | First ayah to address Allah in the 2nd person ("You"); marks the shift from praise to petition. | Direct grammatical-person reading of the rendered text. |
| 1:6 | "Guide us to the straight path -" | The concrete content of the request introduced at 1:5. | Direct paraphrase of the rendered text's own wording. |
| 1:7 | "The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray." | The "straight path" of 1:6 is made concrete by contrast with two other paths. | Direct reading: the rendered text itself states the contrast ("not of those who..."). |

**Verified directly against local Supabase** (not trusted from a
transcription) before finalizing:
`select ayah_number, translation_en from ayahs where surah_number = 1 order
by ayah_number` against `127.0.0.1:54321`.

### 3.1 French Qur'an-text translation availability — a real, pre-existing gap

The governed French Qur'an translation (Kazimirski, 1869,
`kazimirski-1869-segments-v1`) is **schema-only in every migration under
`supabase/migrations/`** — 0 data rows. The actual segment text is applied
to *production only*, out-of-band, by a script outside the migrations
folder (`scripts/quran-import/kazimirski/import_production_kazimirski.py`).
This is confirmed by `scripts/validate-quran-content.mjs`'s own Kazimirski
checks being conditionally skipped everywhere except a hard requirement in
`production-validation.yml`.

**Consequence for this batch**: every `quran_example` section citing an
Al-Fatiha ayah will render its live Arabic text and (in production) its
Kazimirski French translation correctly, but **in any local or CI database
built from `supabase/migrations/`, the French-locale ayah translation will
show as unavailable** — exactly the same pre-existing behavior Level 5's
own Al-Fatiha `quran_example` citations already have today. This batch does
not introduce this gap and does not attempt to fix it (out of scope — it is
a data-import/governance question, not a curriculum-authoring one).

### 3.2 French lesson prose is independently authored, not a translation quotation

The French text in this batch's `body_fr` / `prompt_fr` / French `payload`
values (lesson explanations, exercise prompts, answer choices) is
independently composed pedagogical prose — the same authoring pattern Level
5's own migrations used — **not** a quotation of Kazimirski or any other
governed French Qur'an translation (per §3.1, none is available to quote
from in this schema). Where French prose paraphrases what an ayah says
(e.g. Lesson 2's rendering of 1:6), that paraphrase is a **deliberately
literal French rendering of the actual rendered English (Sahih
International) wording specifically** (e.g. "Guide us" → "Guide-nous", not
"Montre-nous"; "Sovereign of the Day of Recompense" → "Souverain du Jour de
la Rétribution", not "Maître du Jour du Jugement") — chosen to keep every
French sentence traceable back to the one source cited in §3, rather than
blending in word choices from Pickthall or any other translation tradition.
It should still be reviewed by a qualified French-speaking reviewer
alongside the English, for both linguistic accuracy and doctrinal
neutrality — it carries the same review requirement as the English prose,
not a lesser one.

---

## 4. Full lesson content (as authored in the migration)

Reproduced here for reviewer convenience; the migration file is the
authoritative source. "Concept" review-item keys are shown because they are
part of the reviewable design (a wrong or colliding key would silently
corrupt a learner's spaced-repetition queue) — verified against the current
database that no existing `matching` exercise anywhere in the curriculum
references Surah 1, so none of these keys can collide with existing review
items.

### Lesson 1 — `al-fatiha-orientation-and-structure`

**Sections** (explanation → quran_example 1:1 → explanation → summary):
introduces studying Al-Fatiha as one complete surah; identifies the
praise/petition two-part structure and the 3rd-to-2nd-person shift at ayah
5 as the turning point.

**Exercises**: (1) multiple_choice — which ayah first addresses Allah
directly; (2) true_false — ayat 1–4 praise, 5–7 request; (3) matching —
part → function, 3 pairs (`concept:Ayat 1-4`, `concept:Ayat 5-7`,
`concept:The turning word`).

### Lesson 2 — `al-fatiha-tracing-meaning`

**Sections**: explanation (introduces that 1:3/1:4/1:6 have never been
studied for meaning before) → quran_example 1:3 → quran_example 1:4 →
quran_example 1:6 → summary.

**Exercises**: (1) multiple_choice — what ayah 4 adds; (2) true_false —
ayah 6 is the central request; (3) matching — ayah → function, 3 pairs
(`concept:Ayah 3`, `concept:Ayah 4`, `concept:Ayah 6`).

### Lesson 3 — `al-fatiha-synthesis-praise-and-petition` (capstone)

**Sections**: explanation (the full praise → worship/help → guidance →
concrete-path arc) → quran_example 1:7 → tip (the build, restated) →
summary.

**Exercises** (no `matching`, zero new review items, matching the
established capstone pattern from Levels 3/4/5): (1) multiple_choice —
which ayah makes the request concrete; (2) true_false — ayah 7 contrasts
the path with two others (correct answer: the *false* branch, since the
statement as posed is itself false — reviewer should double check exercise
polarity is not confusing); (3) multiple_choice — order the surah's
movement (praise → request → concrete path).

---

## 5. Design decisions made, and why

### 5.1 Level 6's `levels.slug` was **not** renamed

Level 5's placeholder was renamed (`reading-comprehension` →
`guided-ayah-comprehension`) because its generic placeholder name no longer
matched its actual content. Level 6's existing title/goal
("Qur'anic Comprehension" / "Read and understand longer Qur'anic passages
with confidence.") already accurately describes complete-surah study — the
minimal, lowest-risk choice was to leave `levels.slug`, `title_en/fr`, and
`goal_en/fr` untouched and add content under the existing row, rather than
introduce an unforced rename. **Open for reviewer reconsideration** — see
§7.

### 5.2 `STEP_LEVEL_SLUGS` wiring

`src/lib/placement.ts` gets exactly one new entry, mirroring the existing
`ayah_comprehension` entry's shape exactly:

```ts
surah_mastery: {
  levelSlug: "quranic-comprehension",
  requiresLevelSlug: "guided-ayah-comprehension",
},
```

This gates Level 6 on Level 5 (`guided-ayah-comprehension`) being 100%
complete (`completedCount === totalCount`), the same mechanism that already
gates every other level transition in this app. No other application code
changes — `findCurriculumEntryPoint` is already fully data-driven per its
own doc comment and the Level 5 migrations' own confirmation of the same.

**This wiring is the literal "go live" switch for the authenticated
`/learning-plan` experience.** Merging it means a learner who completes
Level 5 will see a real, clickable Level 6 lesson — independent of whatever
the public marketing page says. See §7's blocking-decision list.

### 5.3 Direct lesson-URL gating — a systemic, pre-existing gap, not fixed here

Confirmed by direct code inspection: **no level in this application enforces
prerequisite gating at the URL/route/RLS layer, for any level.**
`lesson.$lessonId.tsx` has no `beforeLoad` check beyond authentication;
`fetchLessonForPlayer` fetches by raw lesson ID with no join to
`learning_path_steps`; `lessons`/`lesson_sections`/`lesson_exercises` RLS
policies are `USING (true)` for both `authenticated` and `anon`. Today, a
learner (or anyone with a lesson's UUID) can open any lesson directly by
URL regardless of level completion — this is true for Level 2 vs Level 1,
Level 5 vs Level 4, and would be equally true for Level 6 vs Level 5. This
batch does **not** introduce new server-side gating, because doing so would
be a cross-cutting security change affecting all six levels, not a Level-6
content change — out of scope for a focused content PR, and risky to bolt
on unreviewed. It is recorded here as a **pre-existing, systemic finding**,
not a Level-6-specific defect, and flagged in §7 as something the project
should decide on separately.

---

## 5.4 Public `/learn` copy: Level 4/5 cards were swapped, Level 6 slot question left open

The public `/learn` page's six marketing cards do not actually align 1:1
with the six real `levels.number` rows — `course.levels[0]` ("Arabic
foundations") and `[1]` ("Reading") both describe the real Level 1
(`foundations-of-arabic-script`, which spans four PATH_STEPS), which shifts
every later marketing card one position ahead of the real level it should
describe. Verified directly against the migrations (not assumed): with
that shift, marketing card 4 should describe real Level 3
(`roots-and-word-patterns`) and marketing card 5 should describe real Level
4 (`core-grammar`) — but the copy had them backwards ("Level 4: Grammar
foundations", "Level 5: Roots and morphology"), the reverse of the order
roots and grammar are actually taught in
(`src/lib/placement.ts`'s own `PATH_STEPS`: `"roots"` before `"grammar"`).
**Fixed in this batch** — `src/locales/{en,fr}/learning.ts` cards 4 and 5
now carry each other's title/topics, confirmed against `52-production-polish.spec.ts`
(56/56 still pass — that file has no test tied to either card's specific
wording).

**Left open, not fixed here**: with that same +1 shift, marketing card 6
("Qur'an comprehension", coming soon) sits one position ahead of real Level
5 (`guided-ayah-comprehension`) — which is not "coming soon," it has been
live since Batch 1 shipped. Real Level 6 (this batch's content) has no
marketing card of its own at all under the current 6-card structure. The
correctly-aligned fix is a deeper one — collapsing marketing cards 1+2 back
into a single "Level 1" card (matching the one real underlying DB level),
which frees a slot so each of the remaining five cards can shift down to
align 1:1 with real Levels 2 through 6. That is a site information-
architecture decision (card count, all six cards' copy, and
`52-production-polish.spec.ts`'s card-count-dependent assertions), not a
content-accuracy fix, so it is recorded here rather than made unilaterally
inside a Level 6 content PR. Until it's decided, marketing card 6's
existing copy ("Complete Ayat", "Meaning in context", "Comprehension
checks") is left as-is — it happens to describe this batch's actual Level 6
content reasonably well, better than it ever described real Level 5, even
though its position is one slot off from where a strict 1:1 mapping would
put it.

## 6. What is NOT included in this batch

- No change to Quran text, any governed translation, attribution, or source
  metadata.
- No change to Levels 1–5, placement logic beyond the one new
  `STEP_LEVEL_SLUGS` entry, progress calculations, authentication, or
  payment behavior.
- No change to the public `/learn` or `/features` marketing copy for Level
  6 — it still reads "Coming soon" / "Bientôt disponible" (see §7 — this
  batch's public-copy change is limited to *fixing the Level 5 card*, which
  was already wrong before this batch and is unrelated to whether Level 6
  ships).
- No audio, memorization, or recitation-count feature — this batch reuses
  the existing `quran_example` → `AyahPlayButton` machinery exactly as
  Level 5 does, with zero schema change (confirmed no per-ayah audio table
  exists or is needed; audio is resolved live from a public reciter API).
- No new exercise type, section type, or database table/column. All 6
  existing `exercise_type` values and 8 existing `content_type` values were
  considered; this batch uses `multiple_choice`, `true_false`, and
  `matching` only (no `reading_check` — deliberately, to avoid overlapping
  Level 1 Module 8's territory).

---

## 7. Open decisions requiring qualified human sign-off before this can ship

None of the following were decided unilaterally. This batch is prepared as
a reviewable candidate; each item below is a specific, named blocking
question.

1. **Doctrinal/interpretive review of the praise → petition structural
   reading.** The "ayat 1–4 praise, ayat 5–7 petition, turning at 'You' in
   ayah 5" framing (Lesson 1 and Lesson 3) is a widely-repeated, structural
   observation grounded directly in the rendered English text's own
   grammatical person — but it is still an interpretive framing of the
   surah's shape, and this batch's author is not a qualified reviewer.
   **Needs explicit sign-off.**
2. **French pedagogical prose review** (§3.2) — accuracy and neutrality of
   the independently-authored French paraphrases, separate from (and in
   addition to) the English review in item 1.
3. **Whether to rename `levels.slug`** from `quranic-comprehension` (§5.1)
   — a naming/branding decision, not a content one, but affects the
   migration's exact SQL if reversed later.
4. **Whether to actually wire `STEP_LEVEL_SLUGS.surah_mastery`** (§5.2) as
   part of this same PR, or hold that specific change for a separate,
   later PR once content review is complete. This branch includes the
   wiring (needed to write and run the gating E2E test at all), but wiring
   it is equivalent to making Level 6 live for any learner who finishes
   Level 5, the moment this branch merges to `main` and deploys — **this
   is the actual release gate, not the "Coming soon" label**, which lives
   on a page most learners approaching Level 6 won't be looking at.
5. **The pre-existing direct-URL gating gap** (§5.3) — a systemic
   application-wide finding, not something this batch fixes or was asked
   to fix. Needs a separate, explicit project decision on priority.
6. **Whether "surah mastery" should include a memorization/audio
   assessment claim** — per the original plan doc, this batch does not add
   one, and the public Level 6 copy must not claim it exists.
7. **Whether to collapse the public `/learn` page's marketing cards 1+2
   into one**, to give real Level 6 its own correctly-positioned card
   instead of card 6 standing in for it one slot early (§5.4). A site
   information-architecture decision, not a content-accuracy one — left
   open deliberately.
