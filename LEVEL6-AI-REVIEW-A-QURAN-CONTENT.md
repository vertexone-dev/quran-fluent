# Level 6 Batch 1 — AI Review A (Qur'an Content), Independent Pass

**This is an AI-assisted pre-publication review, not a qualified human
approval.** It was produced by an AI system (Claude, acting as "Reviewer A")
following the instructions in `LEVEL6-REVIEW-PACKET-A-QURAN-CONTENT.md`. It
does not constitute sign-off by a human Islamic-studies scholar or a
credentialed reviewer of any kind, and nothing in this document should be
read as approving Level 6 for publication or as satisfying the human-review
checklist in `LEVEL6-CONTENT-LEDGER.md` §7. It is a second, independent,
deliberately adversarial check on top of `LEVEL6-RESEARCH-REVIEW.md`, not a
replacement for the qualified human review both documents say is still
required.

Reviewed: `supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`
(read in full, all 637 lines), `LEVEL6-CONTENT-LEDGER.md` (492 lines),
`LEVEL6-RESEARCH-REVIEW.md` (318 lines), `LEVEL6-REVIEW-PACKET-A-QURAN-CONTENT.md`
(137 lines), the relevant Level 1/4/5 migrations in full, and the
translation-resolution code (`src/lib/quran.ts`, `src/lib/translations.ts`,
`src/lib/kazimirski.ts`, `src/lib/translation-labels.ts`,
`src/components/learning/LessonSectionRenderer.tsx`). External sources were
independently re-fetched live (quran.com API, Sunnah/hadith encyclopedias,
Yaqeen Institute, Darul Iftaa Birmingham/IslamQA) rather than trusted from
the prior passes' citations.

**Method note**: I did not accept any "Supported" / "RED ITEMS: 0" /
"no collision" conclusion in the ledger or research review on their own
say-so. Every ayah quote was independently re-fetched from `api.quran.com`
translation resource 20 (Saheeh International) and compared word-for-word.
Every duplication claim against Levels 1, 4, and 5 was checked by reading
those migrations directly, not by trusting the summaries in the ledger.
Every code claim about which translation actually renders was checked by
reading the component and library source directly. This surfaced one
**new, previously unreported factual error** in the ledger's own claims
(see Finding N1 below), independent of anything flagged by the prior
research pass.

---

## Summary

**27 items reviewed** (22 learner-facing English strings/exercises across
the three lessons, plus 5 cross-cutting findings that don't reduce to a
single string).

| Verdict | Count |
|---|---|
| `APPROVED` | 15 |
| `REPLACE WITH` | 2 |
| `NEEDS SOURCE` | 1 |
| `REMOVE` | 0 |
| `HUMAN JUDGMENT REQUIRED` | 9 |

### Everything that is not a plain `APPROVED`

1. **L1-S2 / L1-S3 / L1-E1 / L1-E2** (Lesson 1: the explanation, summary,
   true_false, and matching exercise all asserting "ayat 1–4 praise, ayat
   5–7 request") — `HUMAN JUDGMENT REQUIRED`. Same underlying question as
   Packet A Item 1, but I flag it more sharply here: two of the four
   instances (`E1`, `E2`) are **graded exercises**, and `E2` is a `matching`
   exercise that seeds a **spaced-repetition review item** — meaning this
   contested framing gets reinforced to the learner indefinitely, not just
   stated once in prose. That is a materially higher stake than Packet A's
   framing suggests. See detail below.
2. **L2-S2** (Lesson 2, ayah 4: "It is still praise, still describing
   Allah in the third person") — `HUMAN JUDGMENT REQUIRED`. Confirms Packet
   A Item 1 / ledger F2 independently (I re-fetched both the Darul Iftaa
   Birmingham page and the Yaqeen Institute article myself; both say what
   the ledger claims they say).
3. **L2-E0** (Lesson 2, multiple_choice: "What does ayah 4 add to **the
   surah's praise of Allah**?") — `REPLACE WITH: "What does ayah 4 add to
   the surah's description of Allah?"`. The correct answer itself
   ("His authority over the Day of Judgment") is uncontested, but the
   prompt's own wording presupposes ayah 4 is categorized as "praise" —
   silently importing the disputed framing into a question whose tested
   fact doesn't actually require it. Swapping "praise" for "description"
   preserves the identical tested knowledge without the presupposition.
4. **L3-E0** (Lesson 3, multiple_choice: "Which ayah first makes the
   request **concrete**...") — `REPLACE WITH: "Which ayah first names the
   specific request — what exactly are we asking Allah for?"`. New finding,
   not caught by the prior research pass: the word "concrete" is used for
   two different things four sentences apart in this same lesson — ayah 6
   makes the *request* concrete (this exercise) and ayah 7 makes the *path*
   concrete (the very next exercise, `L3-E1`, and the lesson's own tip
   section). A learner who just read "made concrete by the path's contrast
   (ayah 7)" in the tip section, then immediately hits "which ayah first
   makes the request concrete," has a real, non-doctrinal reason to guess
   "Ayah 7" and be marked wrong. Removing "concrete" from this prompt fixes
   the ambiguity without touching the graded content.
5. **L3-S1 body text + L3-E1 explanation text** ("...those who have
   **evoked** [Your] anger...") — `HUMAN JUDGMENT REQUIRED`, same as Packet
   A Item 2. Independently reconfirmed: the live `api.quran.com` Saheeh
   International text (resource id 20) currently reads "**earned**," while
   this app's stored `ayahs.translation_en` and everything the lesson
   player actually renders reads "**evoked**." The lesson's wording is
   faithful to what the app itself shows the learner, which is the more
   defensible choice pedagogically (what you teach should match what you
   show) — but the underlying edition/printing question is still open. See
   Finding N2 below for a related, previously-undocumented governance gap.
6. **`NEEDS SOURCE`**: the specific print edition/year of Saheeh
   International behind `ayahs.translation_en` (1997 vs. 2004, per the
   ledger's own speculation) has never been confirmed against a physical or
   otherwise verifiable copy, by either this review or the prior one. This
   is a `content_sources` documentation gap, not a lesson-text defect.
7. **Item 3 (attribution)** — `HUMAN JUDGMENT REQUIRED`, cross-cutting,
   confirmed by direct code read: `quran_example` sections show no
   translator/edition attribution anywhere in the UI.
8. **New Finding N1** (see below) — `HUMAN JUDGMENT REQUIRED`. The
   ledger's own §3.1 claim that `quran_example` sections render Kazimirski
   French text "in production" is **independently confirmed false** by
   reading the actual rendering code. This is a factual correction to the
   ledger itself, not a Level 6 lesson-text defect, but it affects how much
   the ledger's other unverified claims should be trusted at face value.
9. **New Finding N2** (see below) — `HUMAN JUDGMENT REQUIRED`. Level 6's
   French rendering of ayah 1:4 ("Souverain du Jour de la Rétribution")
   conflicts with both the app's own legacy French column and Level 4's
   own existing French rendering of the identical Arabic phrase ("Maître
   du Jour de la rétribution"), the opposite of what the ledger's §3.2
   claims about this choice. Primarily Packet B's domain, but I surfaced it
   independently while reading the required Level 4 migration, so I record
   it here rather than drop it.

Everything else — 15 items — is `APPROVED`: verified as either a direct,
exact quotation of the app's own rendered translation text, an accurate,
uncontested textual/structural observation, or a defensible, non-overstated
pedagogical simplification.

---

## Independent findings beyond Packet A / the research review

### Finding N1 — The ledger's §3.1 claim about production Kazimirski rendering is false, confirmed by reading the actual code

`LEVEL6-CONTENT-LEDGER.md` §3.1 states: "every `quran_example` section
citing an Al-Fatiha ayah will render its live Arabic text and (in
production) its Kazimirski French translation correctly."

This is not what the code does. I traced the exact call path:

- `src/components/learning/LessonSectionRenderer.tsx:9` imports
  `ayahTranslation, fetchAyah` from `@/lib/quran` — **not**
  `fetchAyahsWithTranslations`.
- `QuranExampleSection` (same file, lines 92–144) calls `fetchAyah(surah,
  ayah)` — a raw, single-row `select * from ayahs where surah_number=...
  and ayah_number=...` — and renders `ayahTranslation(data, locale) ??
  d.quran.reader.translationUnavailable`.
- `ayahTranslation()` (`src/lib/quran.ts:130-135`) for `locale === "fr"`
  returns `ayah.translation_fr` directly — the **legacy column** — with no
  Kazimirski involvement at all.
- Kazimirski (`src/lib/kazimirski.ts`, `fetchKazimirskiRenderForSurah`) is
  only ever reached through `fetchAyahsWithTranslations`
  (`src/lib/quran.ts:179-232`), which is called from exactly two places in
  the whole app: `src/components/quran/AyahReader.tsx:89` (the standalone
  Reader) and `src/routes/_authenticated/memorize.tsx:250` (the
  memorization feature). **`LessonSectionRenderer.tsx` is not one of
  them.**
- Separately, `ayahs.translation_fr` is not merely absent for Al-Fatiha in
  local/CI builds as the ledger implies — it is **null for every row in
  the entire table, everywhere, including production**. Migration
  `20260911110000` (`Remediation for the disputed fr.hamidullah legacy
  French translation`) explicitly runs `UPDATE public.ayahs SET
  translation_fr = NULL` for all 58 previously-populated rows (Al-Fatiha
  included — surah 1 is named in that migration's own precondition list)
  and asserts as a postcondition: `SELECT count(*) ... WHERE translation_fr
  IS NOT NULL` must equal 0. That migration's own comment explains why:
  the legacy French text was the disputed Hamidullah translation
  (translator's own documented objection to unconsented revisions by the
  publisher), and it was deliberately nulled "so nothing disputed is
  served to users while this is unresolved."

**Net effect**: in production, today, a French-locale learner opening any
lesson's `quran_example` section — including all five new Al-Fatiha
citations in this Level 6 batch — sees "translation unavailable," not
Kazimirski French text, regardless of whether the out-of-band Kazimirski
import script has been run against production. Kazimirski only ever
reaches the standalone Reader and the memorization feature. This is a
correction to the ledger's own factual claim, not a defect in the Level 6
lesson text itself (no lesson-text string asserts this), but it means
§3.1's "in production... correctly" framing should not be relied upon
without this correction, and the open governance question in §7 item 3
understates the gap: it isn't just "no attribution," the French rendering
path for lessons is currently non-functional everywhere, by design,
pending the disputed-source resolution.

### Finding N2 — Level 6's French rendering of ayah 1:4 contradicts Level 4's own prior rendering of the identical phrase

Confirmed by direct comparison across three sources:

- `ayahs` seed data (`supabase/migrations/20260818042151...sql:90`), the
  app's own legacy row: `'مَٰلِكِ يَوْمِ ٱلدِّينِ'` → `'Maître du Jour de la
  rétribution.'`
- Level 4 (`supabase/migrations/20260907100000...sql:282`), the
  `lord-of-the-worlds` lesson's own French `quran_example` body for the
  same ayah: `"maliki yawmi d-din, « Maître du Jour de la rétribution »"`.
- Level 6 (this migration, line 342), Lesson 2's French body for the same
  ayah: `"L'ayah 4 — « Souverain du Jour de la Rétribution »"`.

`LEVEL6-CONTENT-LEDGER.md` §3.2 explicitly defends this word choice as
deliberately literal-to-English fidelity, contrasting it with what it calls
an avoided alternative: *"'Sovereign of the Day of Recompense' → 'Souverain
du Jour de la Rétribution', not 'Maître du Jour du Jugement.'"* But "Maître
du Jour de la rétribution" (with "rétribution," matching Level 6's own
"Recompense"-based ending) is not a hypothetical rejected alternative — it
is **the exact wording already used twice elsewhere in this same app** for
this exact Arabic phrase: once in the governed seed data, once in Level 4's
own lesson content that a learner reaching Level 6 has already studied.
Level 6 introduces a third, different French rendering ("Souverain")
for a phrase the learner has already seen called "Maître" twice before.
This is a terminology-consistency problem across levels, not a
doctrinal one (both "Maître" and "Souverain" are defensible glosses of
*mālik*), but it undercuts the ledger's own stated rationale for the
choice and is the kind of cross-level consistency check this task asked me
to perform directly against Level 4's migration rather than trust the
ledger's account of it. Primarily relevant to Packet B (French content
review), recorded here because I found it while independently verifying
Level 4/Level 6 overlap as directed.

---

## Lesson-by-lesson detail

*(All Arabic/English quotes below were re-verified against a live fetch of
`api.quran.com` translation resource 20, chapter 1, and matched exactly
except where "evoked"/"earned" is explicitly discussed.)*

### Lesson 1 — `al-fatiha-orientation-and-structure`

**S0** (`...sql:226-229`, explanation) — "You have already read all seven
ayat of Al-Fatiha aloud, and in Level 5 you recognized several of its
grammatical particles..." Classification: plain factual/structural claim
about the curriculum. Independently verified: Level 1 Module 8
(`20260901100000...sql`) does read all 7 ayat aloud (confirmed, full file
read); Level 5 Batch 1 (`20260910100000...sql`) does use 4 of Al-Fatiha's 7
ayat (1:1, 1:2, 1:5, 1:7) for particle recognition (confirmed, full
relevant sections read). **Verdict: `APPROVED`.**

**S1** (`...sql:231-236`, quran_example 1:1) — "Al-Fatiha -- 'The Opening'
-- begins here, with the same ayah that opens the Qur'an itself."
Classification: named-translator-independent factual claim (surah-name
translation) + plain observation. "The Opening" as the literal meaning of
*al-Fātiḥa* (root *f-t-ḥ*, "to open") is well established and uncontested
(cross-checked against Wikipedia's Al-Fatiha article, consistent with every
standard reference). Ayah 1 being the Bismillah, and the Bismillah opening
"the Qur'an itself" (as the first surah's first ayah) is a plain textual
fact, confirmed against the app's own `bismillah_pre = false` flag for
Surah 1 (`src/lib/quran.ts:30-33`, confirming Al-Fatiha's own stored ayah 1
*is* the Bismillah, not a separately-rendered pre-text). **Verdict:
`APPROVED`.**

**S2** (`...sql:238-242`, explanation) — "Read together, Al-Fatiha's seven
ayat fall into two parts. Ayat 1 to 4 praise Allah... Ayat 5 to 7 turn to a
direct request. The turn happens at 'You' in ayah 5..." Classification:
interpretive/structural claim, grounded in a named primary source (Sahih
Muslim 395/395a) and a named contemporary scholar (Dr. Nazir Khan, Yaqeen
Institute), but contradicted on the specific ayah-4 question by a second
named, credible source. I independently re-fetched both:
- Sahih Muslim 395a (searched independently, cross-checked against
  hadeethenc.com's Encyclopedia of Translated Prophetic Hadiths and a
  general web search rather than trusting the ledger's excerpt): Allah's
  recorded response to ayah 4 ("Master of the Day of judgment") is "My
  servant has glorified Me" — grouped with the praise-response pattern,
  no dividing language yet. The dividing language ("This is between Me and
  My servant") appears only at the response to ayah 5. This does support
  the lessons' 4+3 division as a defensible primary-source-grounded
  reading.
- Darul Iftaa Birmingham / IslamQA (fetched directly, not from the
  ledger's quote): confirmed verbatim — "the first three are in praise of
  Allah, while the last three contains a request or a prayer," and "the
  fourth verse has a double aspect. One of praise and another of prayer."
  This is a real, credible, named alternate framing (3+1+3, ayah 4
  transitional) that the lesson's flat "It is still praise" (in Lesson 2)
  and "ayat 1 to 4 praise Allah" (here) do not acknowledge.
- Yaqeen Institute (fetched directly): confirms the grammatical
  third-to-second-person shift at ayah 5 (*iyyāka na'budu*) as a real,
  independently-observable fact, not merely inferred.

Both the primary-source and Darul Iftaa framings are real and defensible;
this is a genuine point of scholarly divergence, not a resolved fact
presented as one. **Verdict: `HUMAN JUDGMENT REQUIRED`** — same open
question as Packet A Item 1, independently reconfirmed against both named
sources directly rather than taken on the ledger's word.

**S3** (`...sql:244-248`, summary) — "Two parts, seven ayat: praise (1-4),
then request (5-7), turning at ayah 5." Classification: same interpretive
claim as S2, restated as a terse, unqualified summary — arguably *more*
assertive than S2's prose because a summary line strips any nuance and is
the single sentence most likely to be what a learner remembers.
**Verdict: `HUMAN JUDGMENT REQUIRED`** (same underlying question as S2;
flagged separately because a fix to S2's wording would not automatically
fix this line, which would need the same treatment).

**E0** (`...sql:259-267`, multiple_choice) — "Which ayah is the first to
address Allah directly as 'You'..." Choices: Ayah 2 / Ayah 4 / Ayah 5;
correct = Ayah 5. Classification: plain grammatical-person fact, not
disputed by either named source (both S6/S8 and S7 agree ayah 5 is where
direct address begins — the disagreement is only about how to categorize
ayah 4, not about where second-person address starts). Distractors (ayah 2,
ayah 4) are both genuinely third-person and plausible without being
arguably correct. **Verdict: `APPROVED`.**

**E1** (`...sql:269-277`, true_false) — "Ayat 1 to 4 praise and describe
Allah; ayat 5 to 7 turn to a direct request." correctAnswer: true.
Classification: same interpretive claim as S2/S3, but now **graded** — a
learner is marked right or wrong against a binary answer key derived from
one of two defensible readings. Even granting Darul Iftaa's own wording
("the first three are in praise... the fourth has both aspects, one of
praise and another of prayer"), a strict "ayat 1–4 praise Allah" is not
straightforwardly false under that source either (ayah 4 does have "an
aspect of praise" per Darul Iftaa) — but grading it as flatly `true` with
no room for "it's more nuanced than that" goes further than either source
individually asserts. **Verdict: `HUMAN JUDGMENT REQUIRED`.**

**E2** (`...sql:279-285`, matching) — pairs: "Ayat 1-4" → "Praise: naming
who Allah is"; "Ayat 5-7" → "Request: asking Allah directly"; "The turning
word" → '"You", in ayah 5'. Classification: same claim as E1, but this
exercise type seeds a `review_item_type = 'concept'` **spaced-repetition
review item** (confirmed via the migration's own header comment and
`src/lib/study.ts`'s `seedLessonReviewItems`, which only derives review
items from `matching` exercises). This means the 4+3 framing, once
learned, is scheduled for indefinite spaced re-review as an established
fact — materially higher-stakes than a one-time prose statement or even a
single graded quiz question. **Verdict: `HUMAN JUDGMENT REQUIRED`** — and I
would flag this one as the single highest-priority item in the whole batch
for the qualified reviewer's attention, precisely because of the
spaced-repetition amplification.

### Lesson 2 — `al-fatiha-tracing-meaning`

**S0** (`...sql:326-330`, explanation) — "Ayah 3 has never been studied for
its meaning before now. Ayah 4 and ayah 6 had their individual phrases
explained already, in Level 4's grammar lessons -- but not how they fit
into Al-Fatiha's own arc..." Classification: plain factual claim about
curriculum coverage — this is the corrected version, post-F5. I
independently re-verified this by reading Level 4's `the-straight-path`
and `lord-of-the-worlds` lessons in full (`20260907100000...sql:190-345`):
confirmed `the-straight-path` glosses 1:6 as "the path, the straight [one]"
teaching noun-adjective agreement, and `lord-of-the-worlds` glosses 1:4 as
"Sovereign of the Day of Recompense" teaching the *iḍāfa* construction —
neither lesson discusses the surah's own praise/petition arc for either
ayah. The corrected claim holds up under independent re-verification, not
just re-reading the ledger's account of it. **Verdict: `APPROVED`.**

**S1** (`...sql:332-337`, quran_example 1:3) — "Ayah 3 repeats the same two
names for Allah that closed ayah 1..." Verified: ayah 1's closing text and
ayah 3's full text are both, verbatim, "the Entirely Merciful, the
Especially Merciful" (confirmed against the live API and the app's own
stored `translation_en`). Plain textual observation. **Verdict:
`APPROVED`.**

**S2** (`...sql:339-344`, quran_example 1:4) — "Ayah 4 -- 'Sovereign of the
Day of Recompense' -- adds a new description... It is still praise, still
describing Allah in the third person, like ayat 1 through 3." The quoted
translation phrase is an exact match to the app's rendered text. The
"still praise" characterization is the same disputed claim as L1-S2/S3,
applied specifically to the one ayah where the two named sources most
directly disagree (Darul Iftaa explicitly calls this ayah "double aspect,"
not simply praise). **Verdict: `HUMAN JUDGMENT REQUIRED`.**

**S3** (`...sql:346-351`, quran_example 1:6) — "Ayah 6 -- 'Guide us to the
straight path' -- is the request the surah has been building toward since
ayah 5. It is the specific thing being asked for." This is the corrected
wording (post research-review fix from "the one thing" to "the specific
thing"). Independently checked: ayah 5 itself ("...You we ask for help")
does contain a request too, so "the specific thing being asked for" is
accurate (ayah 6 supplies the content of the request; it doesn't claim
ayah 5 has none). **Verdict: `APPROVED`.**

**S4** (`...sql:353-357`, summary) — "Ayah 3 repeats Allah's mercy as
praise. Ayah 4 adds His authority on the Day of Judgment. Ayah 6 names the
request itself: guidance to the straight path." Purely descriptive,
doesn't use the word "still praise" or otherwise stake out the disputed
ayah-4 characterization — it states what ayah 4 *adds* (authority),
which both named sources agree on, without asserting how to categorize it.
**Verdict: `APPROVED`.**

**E0** (`...sql:368-376`, multiple_choice) — "What does ayah 4 add to
**the surah's praise of Allah**?" Choices: "A new name for Allah" / "His
authority over the Day of Judgment" / "A request for guidance"; correct =
authority over the Day of Judgment. The tested fact (what ayah 4 adds) is
uncontested and correctly keyed. The prompt's own framing ("the surah's
praise of Allah") presupposes the disputed categorization of ayah 4 as
belonging to "the surah's praise," which is not actually necessary to ask
or answer this question. **Verdict: `REPLACE WITH: "What does ayah 4 add
to the surah's description of Allah?"`** (EN only, per this packet's
scope; same correctIndex/choices unchanged — this is a presupposition fix,
not a content or difficulty change).

**E1** (`...sql:378-384`, true_false) — "Ayah 6... is the central request
the rest of the surah builds toward." correctAnswer: true. Independently
re-checked the "central ≠ exclusive" reading the research review already
applied here: "central" signals importance, doesn't claim ayah 5 has zero
request content. Sound. **Verdict: `APPROVED`.**

**E2** (`...sql:386-392`, matching) — Ayah 3 → "Repeats ayah 1's praise as
its own ayah"; Ayah 4 → "Allah's authority on the Day of Judgment"; Ayah 6
→ "The request for guidance." All three right-hand values are plain,
uncontested descriptions (unlike E0/S2, none of them asserts a
categorization of ayah 4 as "praise" — "Allah's authority on the Day of
Judgment" is purely descriptive). **Verdict: `APPROVED`.**

### Lesson 3 — `al-fatiha-synthesis-praise-and-petition` (capstone)

**S0** (`...sql:424-428`, explanation) — "Put together, Al-Fatiha moves in
one direction: praise, then request, then a request made concrete. Ayat 1
to 4 say who Allah is. Ayah 5 turns to address Him directly and states
why... Ayah 6 names the request: guidance. Ayah 7 makes that guidance
concrete, by contrast." Classification: mostly plain/structural. Notably
milder than L1-S2/S3: it doesn't say ayat 1–4 "praise" Allah, only that
they "say who Allah is" — a description both named sources would accept
without qualification, sidestepping the specific ayah-4 dispute. The rest
(ayah 5 shift, ayah 6 as the request, ayah 7 as contrast) is uncontested by
either named source. **Verdict: `APPROVED`** (the mildest, least
overstated version of the structural framing in the batch — worth noting
as a point in the content's favor, not just a pass).

**S1** (`...sql:430-435`, quran_example 1:7) — "The path is described by
contrast: the path of those Allah has bestowed favor upon, not the path of
those who have evoked anger or gone astray..." The paraphrase is faithful
to the app's own rendered `ayahs.translation_en` text for 1:7 exactly,
including "evoked." Notably, and worth explicitly commending: **this
sentence does not identify "those who have evoked anger" or "those who are
astray" with any named group.** Some classical tafsir works do make that
identification (a historically and religiously sensitive interpretive
move); this lesson deliberately stays at the level of the ayah's own text
and does not import that reading. That is the responsible choice.
**Verdict: `APPROVED`** for the structural/contrast claim. Separately, the
"evoked" word choice itself is `HUMAN JUDGMENT REQUIRED` — see Item 2
below, not a defect in this sentence's construction.

**S2** (`...sql:437-441`, tip) — "Notice the build: praise... leads to
worship and a request for help..., which leads to guidance..., made
concrete by the path's contrast (ayah 7)." Accurate restatement of S0/S1.
**Verdict: `APPROVED`** (see also the "concrete" terminology note under
E0 below — the tip itself is fine; the risk is the exercise that follows
it).

**S3** (`...sql:443-447`, summary) — "Seven ayat, one direction: praise,
then worship and help, then guidance, then the path itself." Accurate,
uses "praise" only as a whole-surah gloss, not specifically pinned to ayah
4. **Verdict: `APPROVED`.**

**E0** (`...sql:458-464`, multiple_choice) — "Which ayah first makes the
request **concrete** -- what exactly are we asking Allah to show us?"
Choices: Ayah 5 / Ayah 6 / Ayah 7; correct = Ayah 6. The intended reading
(ayah 6 is the first to name the *specific content* of the request,
distinguishing it from ayah 5's general worship/help request) is
defensible and the clarifying clause helps. But four sentences earlier
(`S2`, the tip section) the lesson used the identical word "concrete" for
a *different* ayah's contribution ("made concrete by the path's contrast
(ayah 7)"), and the very next exercise (`E1`) is graded true/false on
exactly that claim ("Ayah 7 makes the 'straight path'... concrete"). A
learner primed by the tip section to associate "concrete" with ayah 7 has
a real, non-doctrinal reason to answer "Ayah 7" here and be marked wrong.
This is a genuine exercise-design ambiguity, the same category of issue
the prior research pass already found and fixed twice in this same batch
(L2-S3's "the one thing" → "the specific thing"; L3-E1's original
double-negative phrasing) — this is a third instance the prior pass did
not catch. **Verdict: `REPLACE WITH: "Which ayah first names the specific
request -- what exactly are we asking Allah for?"`** (drops "concrete"
entirely from this prompt; same choices, same correctIndex, same tested
knowledge — a wording-precision fix, not a content or interpretive
change).

**E1** (`...sql:472-480`, true_false) — "Ayah 7 makes the 'straight path'
of ayah 6 concrete by contrasting it with two other paths." correctAnswer:
true. This is the already-corrected, positively-phrased version (per
`LEVEL6-RESEARCH-REVIEW.md` row L3-E1). Independently re-verified as
accurate and non-ambiguous in isolation — the ambiguity is only relative to
`E0`, not internal to this item. **Verdict: `APPROVED`** for this item's
own construction. The explanation text ("...the path of those who have
evoked anger, and the path of those who have gone astray") again does not
name any specific group for either category — same commendable restraint
as `S1`. The word "evoked" here carries the same `HUMAN JUDGMENT REQUIRED`
note as `S1` (Item 2), tracked once rather than twice below.

**E2** (`...sql:482-488`, multiple_choice) — "Put Al-Fatiha's movement in
order: (A) the request for guidance, (B) praise of Allah as Lord of the
worlds, (C) the path described by contrast." Choices: "B, A, C" / "A, B,
C" / "C, B, A"; correct = "B, A, C". Accurate ordering (praise → request →
concrete path); uses "praise" only as a whole-surah-level gloss for (B),
not a specific claim about ayah 4. **Verdict: `APPROVED`.**

---

## Item 2 (evoked vs. earned) — my own assessment, for the record

Independently re-confirmed via a live fetch of `api.quran.com`
`/quran/translations/20?chapter_number=1`: the current public Saheeh
International text for 1:7 reads "have **earned** [Your] anger," while
this app's stored and rendered text reads "have **evoked** [Your] anger."
Every other word of all seven ayat matches exactly (independently
re-checked, not just re-confirming the ledger's own character count
claim). I record this as `HUMAN JUDGMENT REQUIRED` per the packet's own
framing, but for the reviewer's benefit: pedagogically, a lesson's wording
matching what the app's own database and UI actually show the learner (as
this one does) is the more defensible default — the alternative (matching
the live public API instead of the local database) would create a lesson
that describes text the learner cannot actually see on screen, which is a
worse failure mode than an unremarkable synonym difference between two
authentic printings of the same named translation. What should not remain
open indefinitely is the `NEEDS SOURCE` item above: which printing
`ayahs.translation_en` reflects should be recorded in `content_sources` (or
an equivalent) rather than left as "likely the 1997 edition, unconfirmed."

## Item 3 (attribution) — confirmed, no new information

Independently confirmed by direct code read of
`LessonSectionRenderer.tsx`: `quran_example` renders only "Surah {surah},
Ayah {ayah}" beneath the translation text, no translator or edition name,
anywhere. This is systemic (every lesson, every level, not Level-6
specific), consistent with the ledger's own claim. `Verdict: HUMAN JUDGMENT
REQUIRED` (scope/priority decision, not a Level 6 content defect).

---

## What this review does not do

It does not approve Level 6 for release. It does not certify that the
praise/petition framing, the ayah-4 characterization, or any interpretive
claim in this batch is doctrinally correct — only that named, checkable
sources exist on more than one side of that question, independently
re-verified rather than taken on trust. It does not review the French
content in depth (Packet B's scope), though two findings that surfaced
during the required cross-referencing of Level 4/5 content are recorded
above (N1, N2) because they bear directly on claims this batch's own
ledger makes about what the app actually does. A qualified human reviewer
with Islamic-studies competence and native/fluent Qur'anic Arabic — which
this review is not a substitute for — is still required before any part of
this batch ships.
