# Level 6 Batch 1 — AI Review Reconciliation

**This is an AI-assisted pre-publication reconciliation, not a qualified
human approval.** It was produced by Claude (Sonnet 5), reconciling two
independent, adversarial AI reviews — `LEVEL6-AI-REVIEW-A-QURAN-CONTENT.md`
(Qur'an content) and `LEVEL6-AI-REVIEW-B-FRENCH.md` (French language),
each completed by a separate agent instance, B genuinely blind to A's
findings until both were finished. Nothing in this document constitutes
sign-off by a qualified human Islamic-studies scholar, a credentialed
French linguist, or any human reviewer. Level 6 remains **UNREVIEWED and
NOT APPROVED for publication**; `LEVEL6-CONTENT-LEDGER.md` §7's human-review
checklist is not satisfied by this document and none of its items are
marked complete here.

Branch `feat/level6-surah-mastery-candidate`, draft PR #31. This
reconciliation applied only changes that met all of the following:
direct factual/terminology repair; clearly supported by an authoritative
source (the app's own existing governed content, established cross-level
precedent, or a standard dictionary); an unambiguous language correction;
and consistent with governed-content restrictions (no canonical Arabic,
governed translation, verse reference, join, hash, or source-metadata row
was touched). Doctrinal, interpretive, attribution-policy, and
release-governance questions were left open, not resolved by assumption.

---

## 1. Agreements between Reviewer A and Reviewer B

Both reviews, working independently, converged on the same two structural
findings — strong evidence these are real, not artifacts of one review's
framing:

1. **The content ledger's §3.1 claim that Kazimirski renders "in
   production... correctly" is false.** A (Finding N1) and B (Finding K)
   each traced `LessonSectionRenderer.tsx` → `fetchAyah()`/`ayahTranslation()`
   independently and found the lesson player never calls the governed
   Kazimirski resolver (`fetchAyahsWithTranslations()`/
   `fetchKazimirskiRenderForSurah()`) — only the standalone Reader and the
   memorization feature do. Both also independently confirmed, against a
   running local Supabase instance, that `ayahs.translation_fr` is `NULL`
   for all seven Al-Fatiha ayat, and traced this to migration
   `20260911110000` (the disputed-Hamidullah remediation), which nulls
   these rows **permanently**, not as a temporary local/CI gap. Both note
   the failure mode is safe (never shows English, never shows the disputed
   text) but never succeeds, in any environment.
2. **Level 6's French rendering of ayah 1:4 ("Souverain du Jour de la
   Rétribution") is an unexplained outlier.** A (Finding N2, found while
   verifying Level 4/5 duplication claims) and B (items 6/11/14, found
   during its own French-fidelity pass) independently landed on the same
   comparison: the app's governed seed data and Level 4's own already-
   shipped lesson both already render this exact Arabic phrase as "Maître
   du Jour de la rétribution." Level 6 introduced a third, different
   rendering with no stated reason to diverge, contradicting the ledger's
   own §3.2 rationale (which compared against a straw-man alternative,
   "...du Jugement," not the actual precedent, "...de la rétribution").
3. Both reviews independently confirmed the batch's duplication claims
   against Levels 1, 4, and 5 by reading those migrations directly (not
   trusting the ledger's summary), and both reached the same conclusion:
   the claims hold.
4. Neither review found any instance of a paraphrase changing a verse's
   actual meaning, any doctrinally-overreaching claim presented as settled
   fact beyond the already-flagged praise/petition question, or any
   ungraded/mis-keyed exercise.

## 2. Where the two reviews' scope did not overlap (not a conflict, a gap)

Reviewer A, working in English, independently flagged that Lesson 2's
multiple-choice prompt ("What does ayah 4 add to **the surah's praise of
Allah**?") presupposes the disputed praise/petition categorization of ayah
4 in its own wording — unnecessarily, since the tested fact (what ayah 4
adds) doesn't require that framing. Reviewer B, reviewing the French
version of the identical prompt, fixed its ayah→verset and Souverain→Maître
issues but did not flag the "praise" presupposition (out of scope for a
pure fidelity/register review — B was checking whether the French
faithfully rendered the English, not re-auditing the English's own
framing). Left uncorrected, applying only A's English fix would have
created a **new** EN/FR mismatch (English no longer presupposing "praise,"
French still asserting "la louange") that did not exist before either
review ran. See §3, correction 6, for how this was resolved.

## 3. Corrections applied

All applied directly to
`supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`
(the migration itself is the authoritative source; also mirrored in this
document for reviewer convenience) and, where a test asserted the exact
changed string, to
`tests/e2e/58-level6-batch1-al-fatiha-surah-study.spec.ts`. No canonical
Arabic, governed translation, verse reference, join, hash, or source
metadata was touched. The migration's own header comment records this pass
inline (search for "CORRECTED, post-authoring, second pass").

### Correction 1 — "ayah"/"ayat" → "verset(s)" throughout Level 6's French prose

- **Reason**: every other French curriculum migration (Levels 1, 4, 5) and
  every French UI string (`src/locales/fr/*.ts`) translates "ayah" as
  "verset" without exception. Level 6 introduced "l'ayah"/"les ayat" as an
  untranslated loanword almost everywhere in its prose (while its own
  exercise prompts and lesson titles correctly kept "verset" — one sentence
  even mixed both terms for the same referent), with no comment anywhere
  indicating this was a deliberate terminology change.
- **Source**: `LEVEL6-AI-REVIEW-B-FRENCH.md`, Finding T — cross-checked
  directly against Level 1 Module 8 (`20260901100000`), Level 4/5
  (`20260907100000`, `20260910100000`), and `src/locales/fr/notes.ts`,
  `bookmarks.ts`, `learning.ts`.
- **Files/rows affected**: every `body_fr` in Lesson 1 sections S0/S2/S3,
  Lesson 2 sections S0/S1/S2/S3/S4, Lesson 3 sections S0/S1/S2/S3; every
  `prompt_fr`/`explanation_fr` in Lesson 1 E0/E1, Lesson 2 E0, Lesson 3
  E1; the French `payload` for Lesson 1 E2 and Lesson 2 E2 (matching-pair
  `left`/`right` values); the DO-block collision guard's checked literal
  list (updated from `'Ayat 1 à 4', 'Ayat 5 à 7'` to `'Versets 1 à 4',
  'Versets 5 à 7'`, and `'Verset 3', 'Verset 4', 'Verset 6'` added for
  Lesson 2's previously-untranslated pair-left keys). Required grammatical
  agreement changes accompanied the term swap throughout ("Lues" → "Lus",
  "étudiée" → "étudié", "elles s'inscrivent" → "ils s'inscrivent" — "verset"
  is masculine).
- **Not changed**: English text (the established policy keeps "ayah/ayat"
  as the English technical term) and the pair-left key "Le mot du
  tournant" (Reviewer B flagged a more idiomatic alternative as optional
  polish only, not required — left as authored).

### Correction 2 — "Souverain du Jour de la Rétribution" → "Maître du Jour de la rétribution" (ayah 1:4)

- **Reason**: matches the wording already used twice elsewhere in this
  exact app for this exact Arabic phrase — the governed `ayahs` seed data
  and Level 4's own already-shipped `lord-of-the-worlds` lesson, which a
  learner reaching Level 6 has already studied. A terminology-consistency
  fix, not a doctrinal one (both "Maître" and "Souverain" are defensible
  glosses of *Malik*).
- **Source**: `LEVEL6-AI-REVIEW-A-QURAN-CONTENT.md` Finding N2 and
  `LEVEL6-AI-REVIEW-B-FRENCH.md` items 6/11/14, converging independently;
  cross-checked directly against `supabase/migrations/20260818042151...sql:90`
  and `supabase/migrations/20260907100000...sql:282`.
- **Files/rows affected**: Lesson 1 E0 `explanation_fr`; Lesson 2 S2
  `body_fr`; Lesson 2 E0 `explanation_fr`.

### Correction 3 — "la guidance" → "être guidé" / "la demande d'être guidé" / "le fait d'être guidé"

- **Reason**: "guidance" is a genuine French dictionary word, but its
  standard register is vocational/educational/psychological counseling
  ("guidance scolaire et professionnelle"), not divine guidance. Used as a
  noun for *hidayah* it reads as an anglicism, inconsistent with the rest
  of the app's French and with Lesson 2's own phrasing of the identical
  idea ("être guidé sur le droit chemin").
- **Source**: `LEVEL6-AI-REVIEW-B-FRENCH.md`, note under Lesson 3 (items
  17, 19, 20, 32, 33) — Larousse/Le Robert cited for "guidance"'s standard
  sense; Lesson 2's own unmodified wording cited as the in-app precedent.
- **Files/rows affected**: Lesson 3 S0 `body_fr`, S2 `body_fr`
  (tip), S3 `body_fr` (summary), E2 `prompt_fr`; Lesson 2 E0 French
  `payload` choices, E2 French `payload` pairs.

### Correction 4 — idiom and capitalization fixes

- `"Mise ensemble, Al-Fatiha avance..."` → `"Pris dans son ensemble,
  Al-Fatiha avance..."` (Lesson 3 S0). Reason: "mettre ensemble" describes
  physically combining separate objects; "pris dans son ensemble" is the
  idiom for "taken as a whole."
- `"L'ayah 5 passe à Lui parler directement"` → `"Le verset 5 passe à
  s'adresser à Lui directement"` (Lesson 1 E0 explanation). Reason:
  "passer à + bare infinitive" is not idiomatic French; matches the
  reflexive verb already used for the same idea elsewhere in the same
  string's own lesson.
- `"La demande de l'ayah 6 devient ici précise"` → `"La demande du verset
  6 se précise ici"` (Lesson 3 S1). Reason: more idiomatic word order,
  shorter (helps on narrow screens). This is a wording-order fix only — it
  does **not** touch the "comblés de... faveurs"/"encouru... colère"
  collocations flagged separately in Finding H (see §4, item 3, left
  unresolved).
- `"au niveau 5"` / `"du niveau 4"` → `"au Niveau 5"` / `"du Niveau 4"`
  (Lesson 1 S0, Lesson 2 S0). Reason: every other real content string in
  this app's migrations that names a level capitalizes "Niveau" (16/16
  non-placeholder instances checked by Reviewer B); this was the one
  exception.
- **Source**: `LEVEL6-AI-REVIEW-B-FRENCH.md`, items 1, 6, 9, 18.

### Correction 5 — English: remove an unnecessary presupposition from Lesson 2's ayah-4 prompt

- **Original**: "What does ayah 4 add to **the surah's praise of Allah**?"
- **Revised**: "What does ayah 4 add to **the surah's description of
  Allah**?"
- **Reason**: the tested fact (what ayah 4 adds — His authority over the
  Day of Judgment) is uncontested and unchanged; the prompt's own wording
  presupposed the disputed praise/petition categorization of ayah 4
  without needing to. Same `correctIndex`, same choices — a presupposition
  fix, not a content or difficulty change.
- **Source**: `LEVEL6-AI-REVIEW-A-QURAN-CONTENT.md`, item L2-E0.
- **Files/rows affected**: Lesson 2 E0 `prompt_en`.

### Correction 6 — French: extend Correction 5 to the matching French prompt

- **Original**: "Qu'ajoute l'ayah 4 à **la louange** d'Allah dans la
  sourate ?"
- **Revised**: "Qu'ajoute le verset 4 à **la description** d'Allah dans la
  sourate ?"
- **Reason**: this is not a wording Reviewer B independently proposed (B
  reviewed the original "la louange" wording and fixed only its
  ayah→verset and Souverain→Maître issues, since B was not shown A's
  English-side presupposition finding). Applying Correction 5 to English
  alone would have left the French prompt asserting "praise" while the
  English no longer did — a **new** cross-language inconsistency neither
  individual review would have produced on its own. "Louange" →
  "description" is a direct, unambiguous cognate translation of the same
  one-word swap A justified, and "description" is already Reviewer B's own
  vocabulary elsewhere in this exact lesson (S2's approved "ajoute une
  nouvelle description," E2's approved "L'autorité d'Allah au Jour du
  Jugement" used descriptively without invoking "louange" at all) — so this
  extension is corroborated by B's own word choices, not invented from
  nothing. Flagged here explicitly because it was not independently
  reviewed by B in this exact form; a human reviewer re-checking one string
  is a small ask relative to leaving a known, mechanical EN/FR mismatch in
  place.
- **Files/rows affected**: Lesson 2 E0 `prompt_fr`.

---

## 4. Conflicts and items deliberately left unresolved

Nothing below was decided by assumption. Each is recorded in
`LEVEL6-CONTENT-LEDGER.md` §7 (items 1, 2, 3, 10, 11, 12) for a qualified
human reviewer.

1. **The praise/petition 4+3 structural framing** (Lesson 1 S2/S3/E1/E2,
   Lesson 2 S2) — both reviews independently re-confirmed this is a
   genuine point of scholarly divergence (a primary hadith source and one
   named scholar support the flat 4+3 reading; a second named, credible
   source treats ayah 4 as transitional). Reviewer A additionally flagged
   that this framing is encoded into a **graded, spaced-repetition matching
   exercise** (L1-E2), not just stated once in prose — the single
   highest-priority item in A's own assessment. **Not resolved here** —
   requires a doctrinal/interpretive human judgment call, explicitly
   excluded from this reconciliation's scope.
2. **"Evoked" vs. "earned" (ayah 1:7)** — both reviews confirmed the app's
   stored/rendered text says "evoked" while the current public
   `api.quran.com` Saheeh International text says "earned," likely an
   edition/printing difference (1997 vs. 2004, unconfirmed). Reviewer A's
   own assessment: matching what the app actually shows the learner (as
   the lesson does) is the more defensible default. **Not resolved here**
   — this is an edition/attribution governance question, not a wording the
   reconciliation can safely rewrite without knowing which edition is
   authoritative.
3. **Finding H — Lesson 3's French wording for ayah 1:7 resembles the
   disputed Hamidullah translation's phrasing** ("comblés de... faveurs,"
   "encouru... colère") stored verbatim elsewhere in this same database.
   Reviewer B explicitly declined to propose a rewrite itself, framing this
   as exactly the kind of case Packet B's own Terminology Question 4
   anticipated needing a direct human answer, not a default "no." **Not
   resolved here.**
4. **The Kazimirski wiring gap** (§1, agreement 1) — a real code defect,
   confirmed by both reviews, but its fix (wiring `QuranExampleSection` to
   the governed Kazimirski resolver) is a cross-level engineering change
   affecting every level's `quran_example` blocks, not a Level-6 content
   edit. **Not fixed here** — out of scope for a content reconciliation;
   recorded as ledger §7 item 10 for separate tracking. The `ayahs`
   table's permanently-nulled `translation_fr` rows (migration
   `20260911110000`) were not touched — that null is itself the correct,
   deliberate remediation for the disputed source, not a bug.
5. **Lesson 3's "concrete" exercise-wording tension** (which ayah first
   makes the request "concrete" — ayah 6 per the graded exercise, but the
   tip section's own wording could be read as pointing to ayah 7) — both
   reviews identified the same underlying ambiguity, in both languages, but
   disagreed on how safely it can be fixed: Reviewer A proposed a specific,
   narrow English rewording; Reviewer B judged that a correct fix requires
   deciding the intended distinction and then wording the tip section and
   the exercise consistently in **both languages together**, and declined
   to propose French wording on that basis. **Not resolved here** —
   applying only A's English-only fix would have left the French
   unconverted and freshly inconsistent with the (fixed) English, the same
   failure mode Correction 6 exists to avoid; applying a reconciliation-
   invented French translation of A's fix would not have been independently
   reviewed by either specialist AI reviewer. Left for a human reviewer to
   resolve in both languages at once.
6. **`ayahs.translation_en`'s specific print edition/year** — neither
   review could confirm this against a physical or otherwise verifiable
   copy; recorded as `NEEDS SOURCE` by Reviewer A. Not something a
   reconciliation pass can resolve without new sourcing.
7. **`quran_example` sections' lack of any translator/edition
   attribution in the UI** — confirmed systemic (every lesson, every
   level) by Reviewer A; a scope/priority decision for the project, not a
   Level-6 content defect.
8. **The `translationUnavailable` fallback string's wording** ("Traduction
   française pas encore disponible pour ce verset" — Reviewer B flagged
   that "pas encore," "not yet," frames a permanent gap as temporary, per
   Finding K). This string is shared across every level's `quran_example`
   blocks, not Level-6-specific; left unchanged pending a project-level
   copy decision.

---

## 5. Verification performed after applying the corrections above

See the commit(s) on this branch for exact results: full lint, typecheck,
unit tests, Qur'an-content integrity validation, build, the targeted Level
6 Playwright spec (including the updated French-locale assertion), and the
complete CI-equivalent Playwright suite against a fresh local Supabase
instance, plus a manual check of English/French rendering at 390×844,
768×1024, and 1440×900. Results are reported in the PR/commit history, not
duplicated here to avoid this document going stale as a second source of
truth for numbers that belong in CI output.

---

## What this document does not do

It does not approve Level 6 for release, does not certify the praise/
petition framing or any interpretive claim as doctrinally settled, and does
not satisfy any item in `LEVEL6-CONTENT-LEDGER.md` §7. It records what two
independent AI reviews found, where they agreed, where their scope simply
didn't overlap, which narrow corrections were safe enough to apply without
a human decision, and which items explicitly still need one. A qualified
human reviewer with Islamic-studies competence and native/fluent Qur'anic
Arabic, and separately a qualified native-French reviewer, are both still
required before any part of this batch ships.
