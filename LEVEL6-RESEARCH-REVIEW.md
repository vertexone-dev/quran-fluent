# Level 6 Batch 1 — Independent Research Review

**This is a research review, not human approval.** It documents what was
independently checked, against which sources, and what still needs a
qualified human reviewer's judgment. It supersedes nothing in
`LEVEL6-CONTENT-LEDGER.md` — it re-verifies that document's conclusions
from scratch, corrects one place where the ledger's own underlying research
was itself imprecise, and adds citations the ledger did not previously
carry. Reviewed commit: **`4138711`** (branch `feat/level6-surah-mastery-candidate`).

**Update (2026-09-20)**: the product owner decided not to pursue external
qualified review and requested a reduced-scope, owner-controlled release
instead — see `LEVEL6-CONTENT-LEDGER.md` Update 3 and
`LEVEL6-OWNER-REVIEW-CHECKLIST.md`. Every claim below marked "Needs
qualification" for an interpretive/doctrinal reason (F2, the L2-S2 row)
has since had the specific disputed wording it identified removed from
the migration, not resolved in either direction — this document's own
findings are still an accurate historical record of what was checked and
why at commit `4138711`, but the exact line numbers and quoted wording in
the "Line-by-line review" table below no longer match the current
migration for the rows this update changed. Treat this document as the
research trail, and `LEVEL6-OWNER-REVIEW-CHECKLIST.md` as the record of
what was actually done in response to it.

## Method

Every claim in the three Level 6 lessons was independently re-checked
against the actual migration SQL (not summaries of it), the actual Level 1
and Level 5 migrations (read in full, not sampled), the actual rendering
code path, and external, named, attributable sources reachable via live
web search and direct API queries — not general background knowledge
presented as verified fact. Where a claim could not be independently
checked against a citable source, it is marked **unverified**, not assumed
correct. Where two credible sources disagreed, both are recorded.

## Classification key

1. Direct observation from Arabic text
2. Named translator's wording
3. Grammatical or structural analysis
4. Interpretation grounded in a named scholarly source
5. Original teaching simplification

## Sources checked

| # | Source | Author / Institution | Used for |
|---|---|---|---|
| S1 | `api.quran.com` v4, `/quran/verses/uthmani?chapter_number=1` | Quran Foundation (quran.com backend) | Official Uthmani Arabic text, Al-Fatiha 1:1–7 |
| S2 | `api.quran.com` v4, `/chapters/1` | Quran Foundation | `bismillah_pre` field, verse count, official name |
| S3 | `api.quran.com` v4, `/quran/translations/20?chapter_number=1` | Quran Foundation (translation resource id 20) | Saheeh International English text, Al-Fatiha 1:1–7 |
| S4 | `api.quran.com` v4, `/quran/translations/19?chapter_number=1` | Quran Foundation (translation resource id 19) | Pickthall English text, Al-Fatiha 1:1–7, for comparison |
| S5 | [Sahih International — Wikipedia](https://en.wikipedia.org/wiki/Sahih_International); [The 'Saheeh International': A 'Saudi' Team Translation — gloqur.de](https://gloqur.de/quran-translation-of-the-week-192-the-saheeh-international-a-saudi-team-translation-into-english/) | — | Saheeh International's translators (Umm Muhammad/Emily Assami, Mary Kennedy, Amatullah Bantley), 1997 first edition (Abul-Qasim Publishing House), 2004 second edition (Al-Muntada al-Islami Trust) |
| S6 | [Sahih Muslim 395a — hadeethenc.com](https://hadeethenc.com/en/browse/hadith/65099) | Encyclopedia of Translated Prophetic Hadiths, narration graded *Authentic*, narrated by Abu Hurayrah | The hadith dividing Al-Fatiha's recitation between Allah and the servant — primary source for the praise/petition structure |
| S7 | [Tafsir of Surah Fatiha — IslamQA (Darul Iftaa Birmingham, Hanafi)](https://islamqa.org/hanafi/daruliftaa-birmingham/20185/tafsir-of-surah-fatiha/) | Darul Iftaa Birmingham | An alternate framing of the surah's division (see Finding F2) |
| S8 | [Secrets of Surah al-Fatihah — Yaqeen Institute](https://yaqeeninstitute.org/read/blog/secrets-of-surah-al-fatihah-how-divine-language-provides-a-moral-compass) | Dr. Nazir Khan (Senior Fellow, Yaqeen Institute; MD, FRCPC) | The grammatical 3rd→2nd person shift at ayah 5 |
| S9 | [Al-Fatiha — Wikipedia](https://en.wikipedia.org/wiki/Al-Fatiha) | — | "The Opening" as the literal translation of the surah's name |
| S10 | Local Supabase, direct `select` queries against `ayahs`, `translations`, `content_sources`, `lesson_sections`, `lesson_exercises`, `review_items` | This app's own database | Actually-stored/rendered text, existing citation footprint, review-item collision risk |
| S11 | Direct read of `src/components/learning/LessonSectionRenderer.tsx`, `src/lib/quran.ts`, `src/lib/translation-labels.ts`, `src/locales/en/quran.ts` | This app's own code | Which translation actually renders where, and what attribution (if any) is shown |
| S12 | Direct read of `supabase/migrations/20260901100000_...sql` (Level 1 Module 8) in full, and `supabase/migrations/20260910100000_...sql` (Level 5 Batch 1) sections referencing Surah 1, in full | This app's own migrations | Duplication check |

**Sources not reached / not independently verifiable**: `sunnah.com` blocks automated fetches (HTTP 403) — S6's hadith text was cross-verified against a second independent site (hadeethenc.com) and a separate web search rather than the canonical sunnah.com page directly; both agree. No access was available to a physical/PDF copy of either Saheeh International print edition (1997 or 2004), so the "evoked" vs. "earned" wording difference (Finding F1) is reported as an observed discrepancy between this app's data and the *current live* quran.com API, not traced to a specific print edition.

## Cross-cutting findings

### F1 — A real wording discrepancy in ayah 1:7, and an unattributed translation edition (data-governance finding, not a content error)

`ayahs.translation_en` for 1:7 (what this app's `quran_example` sections
actually render, confirmed via S10 and S11) reads:

> "The path of those upon whom You have bestowed favor, not of those who
> **have evoked** [Your] anger or of those who are astray."

The current, live `api.quran.com` translation resource id 20 ("Saheeh
International", S3) for the same verse reads:

> "The path of those upon whom You have bestowed favor, not of those who
> **have earned** [Your] anger or of those who are astray."

Every other word of all 7 ayat matches exactly between this app's database
and the live API (confirmed character-by-character, not eyeballed).
**"evoked" vs. "earned" is the only wording difference found anywhere in
the 7 ayat.** The most likely explanation, based on S5, is that this app's
data reflects the 1997 first edition and the live API reflects the 2004
second edition ("a few corrections" — S5), but this could not be confirmed
without access to both physical print editions. This is **not** an error
introduced by the Level 6 lesson content — the lessons' paraphrase ("have
evoked anger") is faithful to what the app itself actually stores and
renders — but it is a real, previously-undocumented data-provenance
question: **which edition of Saheeh International does `ayahs.translation_en`
reflect, and should that be recorded?**

Compounding this: **`ayahs.translation_en` has no attribution shown
anywhere in the UI.** Confirmed by direct code read (S11):
`LessonSectionRenderer.tsx`'s `quran_example` block renders only "Surah
{surah}, Ayah {ayah}" beneath the translation — no translator name, no
edition, no license. By contrast, the standalone Qur'an Reader's Pickthall
text *does* carry a full, careful attribution string ("Marmaduke Pickthall
— Project Gutenberg eBook #16955 digital edition. Public domain in the
United States. Not represented as an exact reproduction of the 1930 first
edition." — `src/locales/en/quran.ts:74`). `src/lib/translation-labels.ts`'s
own existing comment independently confirms the gap: "en_sahih... is a
distinct edition from the governed Pickthall translation the Qur'an reader
itself serves... this preference does not currently change which
translation the reader shows." **This is a pre-existing, system-wide
characteristic affecting every lesson at every level that uses a
`quran_example` block — not something Level 6 introduces —** but Level 6
is the first batch whose content is being held to this level of scrutiny,
so it surfaces here. See Stage 5 for the recommended resolution (documented,
not silently fixed).

### F2 — A real, named alternate scholarly framing of the surah's structure

The lessons' central claim — ayat 1–4 are praise, ayat 5–7 are petition,
the turn happens at ayah 5 — is directly supported by a primary source: the
hadith in Sahih Muslim 395 (S6), in which Allah's own response to ayah 4
("Master of the Day of Judgment") is recorded as "My servant has glorified
Me" (i.e., still counted as praise), and the response to ayah 5 is "This is
between Me and My servant" (i.e., explicitly the dividing line). This is
also independently corroborated on the grammatical level by Dr. Nazir
Khan/Yaqeen Institute (S8): a documented 3rd-person-to-2nd-person shift
beginning at ayah 5's *iyyāka naʿbudu*.

However, a second, credible, named source frames it differently. Darul
Iftaa Birmingham (S7, Hanafi) states: **"the first three are in praise of
Allah, while the last three contain a request... The verse in between the
two sets [ayah 4] has both the features, there is an aspect of praise and
another of prayer."** This is a 3+1+3 reading, treating ayah 4 as
transitional rather than purely praise — different from both the lessons'
own 4+3 framing and from S6's own wording.

**This is a genuine point of scholarly divergence, not a resolved fact.**
The lessons' current wording ("It is still praise, still describing Allah
in the third person" for ayah 4, `20260918100000...sql:304`) is defensible
and grounded in a primary hadith source, but a reviewer may reasonably
prefer language that acknowledges ayah 4's transitional character instead
of asserting it is unambiguously "still praise." **Recommended for
reviewer judgment, not resolved unilaterally** — see the line-by-line table,
item L2-S2.

### F3 — Duplication check: confirmed, independently, against the full text of both prior levels

Read in full (not sampled): `supabase/migrations/20260901100000_...sql`
(Level 1 Module 8, all 3 lessons, all 14 exercises, S12) and the Al-Fatiha-
citing sections of `supabase/migrations/20260910100000_...sql` (Level 5
Batch 1, S12). Every Level 1 Module 8 exercise is either `reading_check`
(pronunciation), `true_false` (an orthographic/structural fact — repeated
words, presence of a shadda, word count), or `multiple_choice` (recall of a
previously-spotted mark, or trivia) — confirmed line by line, none touch
meaning. Every Level 5 citation of Al-Fatiha (1:1, 1:2, 1:5, 1:7) is a
one-paragraph cameo illustrating one specific attached or independent
particle (*wa-*, *al-*, *bi-*, *ʿalā*) — confirmed by reading the full
surrounding paragraph for each citation, not just a sentence fragment; none
discuss the surah's structure, theme, or ayat 1:3/1:4/1:6. **This
independently confirms the ledger's no-duplication claim** for the portion
checked directly; the collision-key search across *all* migrations and the
remainder of Level 5 Batch 2 were delegated to a parallel adversarial
review (reported separately once complete — see Pending checks below).

### F4 — Surah name translation

"Al-Fatiha" = "The Opening" is independently confirmed (S9, Wikipedia,
citing the root *f-t-ḥ*, "to open"). The French rendering used in the
lessons ("l'Ouverture") is a direct, standard translation of "The Opening"
and is not contradicted by any source checked.

### F5 — Addendum: the adversarial re-check found a real overstatement, now corrected

A second, independent pass — explicitly briefed to try to *disprove* the
no-duplication claim rather than confirm it, covering Level 5 Batch 2 in
full and an exhaustive collision search across all 45 prior migrations —
found that **the original duplication check (F3 above, and the ledger's
own §2) was itself incomplete**: it compared the new lessons only against
Level 1 and Level 5, never against Levels 2–4. As a direct result, one
specific claim, repeated in three places, was false.

**What was wrong**: Level 4 ("core-grammar",
`supabase/migrations/20260907100000_9e0c4081-0b4d-4d89-8cc9-c9bdb47c3af1.sql`,
lessons `the-straight-path` and `lord-of-the-worlds`) had already glossed
ayah 1:6 as "the path, the straight [one]" and ayah 1:4 as "Sovereign of
the Day of Recompense" — real phrase-level meaning, while teaching noun-
adjective agreement and the *iḍāfa* ("X of Y") construction. This directly
contradicted the claim that these two ayat had "never" had their meaning
addressed, which appeared in the ledger, in this migration's own SQL
header, **and in the lesson text a learner would actually see** (Lesson
2's opening explanation).

**What was not wrong**: no exact exercise, prompt, or payload duplicates
between Level 4 and the new Level 6 content — Level 4 tests grammar
mechanics (word order, agreement), Level 6 tests the ayat's role in the
surah's structure; the underlying phrase-meaning gloss was reused as a
"first-time" framing device, not the pedagogical fact itself. The
review-item-collision conclusion (no collision) was also independently
re-confirmed, correctly this time (see the ledger §4 correction) — but the
*original* stated verification method for that conclusion checked the
wrong database column and would not have caught a real collision had one
existed.

**Corrections made** (branch `feat/level6-surah-mastery-candidate`, applied
directly, not merely noted): Lesson 2's learner-facing opening text
(migration `20260918100000`) rewritten to claim only what's actually true
— ayah 3's meaning is genuinely new, while ayat 4 and 6's *individual
phrase* meaning was taught in Level 4, and what is new is how all three
fit into the surah's own arc. The migration's own header comment and
`LEVEL6-CONTENT-LEDGER.md` §2 and §4 were corrected the same way, and the
migration's own collision-guard SQL was rewritten to check the actual
JSONB payload text instead of a column matching exercises never populate.
All corrections re-verified: migration re-applied cleanly against local
Supabase, and the full `58-level6-batch1-al-fatiha-surah-study.spec.ts`
suite re-run and passing (see Stage 7 totals).

---

## Line-by-line review

Each row: **ID** | file:line | wording | classification | result. Full
citation and reasoning follows the table for every row not marked
"Supported, no note."

| ID | Location | Result |
|---|---|---|
| L1-S0 | `...sql:198-200` | Supported |
| L1-S1 | `...sql:204-208` | Supported |
| L1-S2 | `...sql:211-214` | Supported (see F2 note) |
| L1-S3 | `...sql:216-220` | Supported (see F2 note) |
| L1-E0 | `...sql:231-239` | Supported |
| L1-E1 | `...sql:241-249` | Supported (see F2 note) |
| L1-E2 | `...sql:251-257` | Supported |
| L2-S0 | Lesson 2, opening explanation | **Corrected** — see F5 |
| L2-S1 | `...sql:295-300` | Supported |
| L2-S2 | `...sql:302-307` | **Needs qualification** (see F2) |
| L2-S3 | `...sql:309-314` | **Needs qualification** (minor, see below) |
| L2-S4 | `...sql:316-320` | Supported (milder phrasing, no exclusivity claim — see below) |
| L2-E0 | `...sql:331-339` | Supported (see F2 note) |
| L2-E1 | `...sql:341-347` | Supported ("central" does not claim exclusivity — see below) |
| L2-E2 | `...sql:349-355` | Supported (see F2 note) |
| L3-S0 | `...sql:387-391` | Supported (see F2 note) |
| L3-S1 | `...sql:393-398` | Supported (see F1) |
| L3-S2 | `...sql:400-404` | Supported (see F2 note) |
| L3-S3 | `...sql:406-410` | Supported |
| L3-E0 | `...sql:421-427` | Supported |
| L3-E1 | `...sql:429-437` | **Needs qualification** (pedagogy, see below) |
| L3-E2 | `...sql:439-445` | Supported |

*(all `...sql:` line numbers refer to `supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`)*

### Detail: rows marked "Needs qualification"

**L2-S2** (`...sql:302-307`) — EN: *"Ayah 4 -- 'Sovereign of the Day of
Recompense' -- adds a new description: Allah's authority specifically on
the Day of Judgment. It is still praise, still describing Allah in the
third person, like ayat 1 through 3."* FR: matching. Classification: 1
(the quoted translation itself, verified exact match to S3) + 4 (the
"still praise" framing, per F2). **Result: needs qualification** — the
translation quote is exact and correct; the "still praise" characterization
is defensible (grounded in S6) but a named alternate source (S7) treats
this verse as transitional. **No proposed replacement text is offered here
by design** — this is exactly the kind of interpretive judgment call
reserved for Packet A's qualified reviewer, per the task's own instruction
not to resolve disputed interpretive wording unilaterally. Two options are
presented in Packet A for the reviewer to choose between (see below), not
decided here.

**L2-S3 only** (`...sql:311-312`) — EN: *"Ayah 6... is the request the
surah has been building toward since ayah 5. It is **the one thing** being
asked for."* Classification: 5 (teaching simplification). **Result: needs
qualification** — minor, not religious/doctrinal. Ayah 5 itself contains a
request too (*nasta'īn*, "we ask for help"), so "the one thing being asked
for" could be misread as claiming ayah 5 contains no request at all, when
the more precise claim is that ayah 6 supplies the *specific content* of
what is asked for. **Proposed replacement, EN**: "It is the specific thing
being asked for." **Proposed replacement, FR**: "C'est la chose précise
qui est demandée." This is a wording-precision fix, not a disputed-claim
fix — safe to apply without further human sign-off, and is implemented in
Stage 5 below.

The nearby, similarly-worded L2-S4 ("Ayah 6 names the request itself")
and L2-E1 ("the central request the rest of the surah builds toward") were
checked against the same concern and found **not** to make an exclusivity
claim — "names the request itself" identifies content, and "central"
signals importance, not uniqueness — so neither was changed.

**L3-E1** (`...sql:429-437`) — EN prompt: *"Ayah 7 describes the straight
path only in general terms, without contrasting it with anything else."*
(`correctAnswer: false`). Classification: 5 (exercise design), not a
content-accuracy issue — the underlying fact (ayah 7 *does* contrast the
path with two others) is correct and independently verified (S3, S10).
**Result: needs qualification** for exercise design, not content: this is
a negatively-phrased true/false item whose correct answer is that the
negative claim is itself false (a double-negative construction — "only...
without contrasting" is false because it *does* contrast). Assessment-
design practice generally recommends against negatively-phrased true/false
items because they increase misread risk independent of subject knowledge.
**Proposed replacement, EN**: *"Ayah 7 makes the 'straight path' of ayah 6
concrete by contrasting it with two other paths."* (`correctAnswer: true`).
**Proposed replacement, FR**: *"L'ayah 7 rend concret le « droit chemin »
de l'ayah 6 en le mettant en contraste avec deux autres chemins."* This
tests the identical knowledge, removes the double negative, and requires no
religious judgment call — implemented in Stage 5 below.

### Detail: all other rows (full citation)

**L1-S0/S1/S3** — Framing/context only ("you have already read...",
"begins here"); no independent religious claim to verify beyond what's
already covered in F3 (the Level 1/5 prior-learning references are
factually accurate, confirmed by S12).

**L1-S2/S3, L1-E1, L2-E0/E2, L3-S0/S2** — Restate or build on the
core praise/petition/turning-point claim; see F2. All quote translation
text exactly matching S3 where quoted (verified).

**L1-E0** — EN: *"Ayat 1-4 describe Allah in the third person ('Lord of
the worlds', 'Sovereign of the Day of Recompense')."* Both quoted phrases
verified exact matches to S3 (character-for-character, aside from the
macron on "Allāh" which this app's data omits throughout — a
typographic/rendering choice, not a wording difference, consistent
throughout every citation checked).

**L3-S1** — See F1: the paraphrase ("evoked anger") matches the app's own
stored/rendered data exactly, not the current live API's "earned anger."
Flagged as a separate data-provenance question, not a content defect.

---

## What this review does not do

It does not approve any claim. Every item marked "Supported" above means
*the claim is grounded in a checked, named source and matches what the app
actually renders* — it does not mean a qualified Islamic studies scholar
or qualified French-language reviewer has signed off on its wording,
theological framing, or pedagogical suitability. Both are still required
in full, per `LEVEL6-CONTENT-LEDGER.md` §7 and the two review packets
below.
