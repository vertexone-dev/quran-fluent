# Level 6 Batch 1 — AI Review, Packet B (French)

**This is an AI-assisted pre-publication review, not a qualified human
approval.** I am Claude (Sonnet 5), not a credentialed French linguist, not
an Islamic-studies scholar, and not a human. Nothing in this document
constitutes sign-off, and Level 6 must not be treated as approved for
publication or as satisfying `LEVEL6-CONTENT-LEDGER.md` §7's human-review
requirement on the strength of this document alone. This review is offered
as one independent input for a qualified human reviewer (and the project's
reconciliation process) to weigh alongside Packet A's findings and its own
judgment.

Reviewed: branch `feat/level6-surah-mastery-candidate`, commit `94551d7`,
draft PR #31. Primary source of truth read in full:
`supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`
(637 lines). Also read in full: `LEVEL6-REVIEW-PACKET-B-FRENCH.md`,
`LEVEL6-CONTENT-LEDGER.md`, `LEVEL6-RESEARCH-REVIEW.md`,
`src/components/learning/LessonSectionRenderer.tsx`, `src/lib/quran.ts`,
`src/lib/translations.ts`, `src/lib/kazimirski.ts`,
`src/lib/translation-labels.ts`, the Level 4 migration
(`20260907100000_9e0c4081-...sql`), the Level 1 Module 8 migration
(`20260901100000_53bb24f4-...sql`), the Level 5 migration
(`20260910100000_1878db2f-...sql`), and the disputed-source remediation
migration (`20260911110000_521fb3f2-...sql`). Verified directly against a
running local Supabase instance (`select ayah_number, translation_en,
translation_fr from ayahs where surah_number = 1`), not assumed from
documentation.

I deliberately did not open `LEVEL6-AI-REVIEW-A-QURAN-CONTENT.md` (the
parallel English-content review) at any point, per my brief, so the
findings below are independently derived.

---

## Summary

**Total learner-facing French items reviewed: 40** (24 items following
Packet B's own numbering, plus 16 additional items — titles, answer
choices, matching-pair values, and UI fallback strings — that the packet's
table did not itemize individually).

| Verdict | Count |
|---|---|
| `APPROUVÉ` | 14 |
| `REMPLACER PAR` | 22 |
| `AVIS HUMAIN REQUIS` | 4 |
| `SOURCE REQUISE` | 0 |
| `SUPPRIMER` | 0 |

### The two most significant findings

**1. Kazimirski never renders for Level 6's `quran_example` sections, in
any environment, including production — this is a code defect, not the
data-availability gap the ledger describes.** `LessonSectionRenderer.tsx`'s
`QuranExampleSection` (the component that renders every `quran_example`
block, including all five of Level 6's) calls `fetchAyah()` +
`ayahTranslation()` (`src/lib/quran.ts`), which reads the **legacy**
`ayahs.translation_fr` column directly. It never calls
`resolveApprovedFrenchSource()` / `fetchKazimirskiRenderForSurah()`
(`src/lib/kazimirski.ts`) — that governed resolver is wired only into
`fetchAyahsWithTranslations()`, which only the standalone Qur'an Reader
uses. Separately, `ayahs.translation_fr` for all seven Al-Fatiha ayat was
permanently nulled by migration `20260911110000` (the disputed-Hamidullah
remediation) — confirmed live against local Supabase. So Level 6's
`quran_example` French translation will show "unavailable" **forever, in
every environment including production with Kazimirski fully imported**,
not just locally/in CI as `LEVEL6-CONTENT-LEDGER.md` §3.1 states. See
Finding K below.

**2. Nearly every French sentence in this batch uses "ayah"/"ayat" as an
untranslated loanword — a term this app has never used in French before.**
Levels 1, 4, and 5's migrations, and every French UI string outside this
migration (`src/locales/fr/*.ts`), consistently translate "ayah" as
**"verset."** Level 6 introduces "l'ayah"/"les ayat" throughout its prose
(while its own exercise *prompts* and lesson *titles* correctly keep using
"verset" — even within the same sentence in one case, L2-S1). The result:
a learner reading "L'ayah 4..." in a lesson card sees the system-generated
caption directly below it read "Sourate 1, **verset** 4" for the exact same
reference. See Finding T below; it drives most of the 22 `REMPLACER PAR`
verdicts.

### Every non-`APPROUVÉ` item, at a glance

| # | Location | Verdict | Issue |
|---|---|---|---|
| 1 | L1-S0 | REMPLACER PAR | lowercase "niveau 5" (app convention capitalizes) |
| 3 | L1-S2 | REMPLACER PAR | ayah→verset; awkward "passe à Lui parler" |
| 4 | L1-S3 | REMPLACER PAR | ayah→verset |
| 6 | L1-E0 explanation | REMPLACER PAR | ayah→verset; "Souverain"→"Maître" (Level 4 precedent) |
| 7 | L1-E1 prompt | REMPLACER PAR | ayah→verset |
| 8 | L1-E2 matching | REMPLACER PAR | ayah→verset (review-item-key implication flagged) |
| 9 | L2-S0 | REMPLACER PAR | ayah→verset; lowercase "niveau 4" |
| 10 | L2-S1 | REMPLACER PAR | ayah→verset (mixes "ayah" and "verset" in one sentence) |
| 11 | L2-S2 | REMPLACER PAR | ayah→verset; "Souverain"→"Maître" |
| 12 | L2-S3 | REMPLACER PAR | ayah→verset |
| 13 | L2-S4 | REMPLACER PAR | ayah→verset |
| 14 | L2-E0 | REMPLACER PAR | ayah→verset; "Souverain"→"Maître" |
| 15 | L2-E1 | REMPLACER PAR | ayah→verset |
| 16 | L2-E2 matching | REMPLACER PAR | ayah→verset |
| 17 | L3-S0 | REMPLACER PAR | ayah→verset; "Mise ensemble" calque; "la guidance" anglicism |
| 18 | L3-S1 | REMPLACER PAR | ayah→verset; "devient ici précise" clunky; see Finding H |
| 19 | L3-S2 | REMPLACER PAR | "la guidance" anglicism; bare "(ayah 7)" |
| 20 | L3-S3 | REMPLACER PAR | ayah→verset |
| 21 | L3-E0 prompt | AVIS HUMAIN REQUIS | internal tension with L3-S1 on which ayah "makes the request concrete" — inherited faithfully from English, not French-introduced |
| 22 | L3-E1 prompt | REMPLACER PAR | ayah→verset |
| 23 | L3-E1 explanation | REMPLACER PAR | ayah→verset; see Finding H |
| 32 | L2-E0 MC choices | REMPLACER PAR | "Une demande de guidance" anglicism |
| 33 | L2-E2 matching pairs | REMPLACER PAR | ayah→verset; "la guidance" anglicism |
| 38 | `quran.ts` fallback string | AVIS HUMAIN REQUIS | "pas encore disponible" implies a temporary gap; per Finding K it is structural, not temporary |
| 39 | L3-S1 / L3-E1 (Terminology Q4) | AVIS HUMAIN REQUIS | wording closely echoes the disputed Hamidullah translation already stored in this DB |
| 40 | (code, not a string) | AVIS HUMAIN REQUIS | Finding K itself — a project-level engineering question, not a Level-6 content fix |

Items not listed above (2, 5, 24–31, 34–37) are `APPROUVÉ` as written.

---

## Cross-cutting findings (read first — they explain most verdicts below)

### Finding T — "ayah"/"ayat" is a new, unprecedented loanword in this app's French

I checked every prior French curriculum migration and every French UI
string in `src/locales/fr/`:

- Level 1 Module 8 (`20260901100000`), which is literally the lesson that
  first taught these same seven ayat, titles its French lessons "Al-Fatiha
  : **versets** 1 à 3" while its English titles say "Al-Fatiha: **Ayahs**
  1-3" — i.e. the established policy is: English keeps "ayah/ayat" as the
  technical term, French always translates it as "verset(s)."
- Level 4 (`20260907100000`) and Level 5 (`20260910100000`) both use
  "verset" exclusively in French prose, dozens of times, never "ayah."
- `src/locales/fr/notes.ts`, `src/locales/fr/bookmarks.ts`:
  `openAyah: "Ouvrir le verset"`.
- `src/locales/fr/learning.ts`'s own auto-generated `quran_example` footer:
  `quranExampleReference: "Sourate {surah}, verset {ayah}"` — this string
  renders directly beneath every one of Level 6's own `quran_example` cards.

Level 6 breaks this pattern almost everywhere in its prose (while its own
exercise *prompts* — L1-E0, L3-E0 — and all lesson *titles* correctly kept
"verset," showing the author knew the convention and simply didn't apply it
uniformly). One sentence mixes both terms for the same referent
(L2-S1: "L'ayah 3 reprend... qui clôturaient **l'ayah** 1... comme un
**verset** à part entière"). Practically, a learner will see "L'ayah 4" in
the lesson prose and "Sourate 1, **verset** 4" in the system caption two
lines below it, for Levels 1/4/5-trained learners who have never seen
"ayah" used as a French word before.

I did not find any indication this was a deliberate terminology upgrade
(no comment in the migration or ledger mentions it, and the mixed usage
within single sentences suggests it wasn't deliberate). My recommendation
in every affected item below is to replace "ayah"/"ayat" with
"verset"/"versets," with the necessary gender-agreement changes
("verset" is masculine; "ayah" was being treated as feminine, e.g.
"étudi**ée**" → "étudi**é**"). I flag but do not resolve one implementation
consequence: the migration's matching-exercise **review-item keys**
(`concept:Ayah 3`, `concept:Ayah 4`, `concept:Ayah 6`,
`concept:Ayat 1-4`, `concept:Ayat 5-7`, `concept:The turning word`, and
their French `pair.left` values `Ayah 3`/`Ayah 4`/`Ayah 6`/`Ayat 1 à
4`/`Ayat 5 à 7`/`Le mot du tournant`) are also the exact strings the
migration's own collision-guard SQL checks (lines 178–190). Renaming the
French `pair.left` values to `Verset 3` etc. is safe for the collision
check itself (it would just check against different literal strings), but
whoever applies this fix should re-run that guard's logic, not just
find-and-replace the SQL.

### Finding K — Kazimirski is never queried by the lesson player's `quran_example` sections, in any environment

`LEVEL6-CONTENT-LEDGER.md` §3.1 states: "every `quran_example` section
citing an Al-Fatiha ayah will render its live Arabic text and (in
production) its Kazimirski French translation correctly, but... in any
local or CI database... the French-locale ayah translation will show as
unavailable." I traced the actual code path and this is incomplete in a
way that matters for review sign-off:

- `LessonSectionRenderer.tsx`'s `QuranExampleSection` (lines 92-144) calls
  `fetchAyah(surah, ayah)` (`src/lib/quran.ts:96-105` — a raw query
  against `public.ayahs`), then computes the displayed translation as
  `ayahTranslation(data, locale) ?? d.quran.reader.translationUnavailable`
  (line 126). `ayahTranslation()` (`src/lib/quran.ts:130-135`) is:
  `return locale === "fr" ? ayah.translation_fr : ayah.translation_en;` —
  it reads the **legacy** column directly. It never calls
  `resolveApprovedFrenchSource()` or `fetchKazimirskiRenderForSurah()`
  (`src/lib/kazimirski.ts`).
- The governed Kazimirski resolver is wired into exactly one function,
  `fetchAyahsWithTranslations()` (`src/lib/quran.ts:179-232`), whose own
  doc comment states the legacy `translation_fr` column "is deliberately
  never read for French anymore." That function is used by the standalone
  Qur'an Reader — I did not find any call to it from
  `LessonSectionRenderer.tsx` or anywhere in the lesson-player code path.
- I queried the running local Supabase instance directly:
  `select ayah_number, translation_en, translation_fr from ayahs where
  surah_number = 1` returns `translation_fr = NULL` for all seven rows.
  This isn't a local/CI-only data gap — migration `20260911110000`
  (the disputed-Hamidullah remediation) permanently nulls exactly these
  seven rows (among 58 total, across Al-Fatiha, Al-Mulk, Al-Asr,
  Al-Kawthar, Al-Ikhlas, Al-Falaq, An-Nas) as a deliberate, permanent
  content decision — it is not a "not yet imported" state that a future
  migration would fill in, and it is not undone by the Kazimirski import
  (which populates `translation_segments`/`translation_segment_ayahs`,
  tables `QuranExampleSection` never queries).

**Net effect**: Level 6's `quran_example` sections will show "Traduction
française pas encore disponible pour ce verset" for every French-locale
learner, in local, CI, **and production** — regardless of whether
Kazimirski is imported. This affects every level's `quran_example` blocks
that cite one of these 58 ayat, not just Level 6, and is a pre-existing
gap this batch inherits rather than introduces — but the ledger's specific
claim that production behaves differently from local/CI for this component
is not supported by the code as written. I recommend this be logged as its
own tracked engineering item (wiring `QuranExampleSection` to
`fetchAyahsWithTranslations`'s resolution logic, or at least to
`fetchKazimirskiRenderForSurah`), separate from Level 6 content sign-off.
The *safety* property does hold: the fallback never shows English text
under French, never shows the disputed Hamidullah text, and never renders
a blank — it fails safely, exactly per `ayahTranslation()`'s contract. It
just never succeeds, for these ayat, no matter the environment.

### Finding H — L3-S1 and L3-E1's French wording closely echoes the disputed Hamidullah translation, not just the cited Sahih-English source

Packet B's own Terminology Question 4 asks whether any French sentence
"could be mistaken for a direct quotation from a published French Qur'an
translation... rather than independently-authored pedagogical prose."
Answer: yes, specifically here. Compare:

- Hamidullah (`fr.hamidullah-crf`, disputed, stored verbatim in this same
  database by migration `20260911110000`, ayah 1:7): *"le chemin de ceux
  que Tu as comblés de faveurs, non pas de ceux qui ont encouru Ta colère,
  ni des égarés."*
- Level 6, L3-S1 (`quran_example` 1:7 body_fr): *"le chemin de ceux qu'Allah
  a comblés de Ses faveurs, non celui de ceux qui ont encouru Sa colère ou
  qui se sont égarés."*
- Level 6, L3-E1 (explanation_fr): *"...le chemin de ceux qui ont encouru
  la colère, et le chemin de ceux qui se sont égarés."*

"comblés de... faveurs" and "ont encouru... colère" are not generic
phrasing choices — they are the same two distinctive collocations, in the
same order, differing only in grammatical person (Hamidullah addresses
Allah directly, "Tu/Ta," matching the ayah's actual second-person Arabic;
Level 6's prose paraphrases in the third person, "Allah/Sa," since it's
describing the ayah rather than voicing it). This could be convergent
translation — these are well-known, frequently recited verses, and
"comblé de faveurs" / "encourir la colère de" are fairly standard French
collocations for these Arabic concepts, not necessarily borrowed. But given
that the *specific* disputed text is sitting in this exact database, and
the ledger goes out of its way to state this prose is "independently
authored... not a quotation of Kazimirski or any other governed French
Qur'an translation," I think a human reviewer should look at this pairing
directly and decide whether it needs distancing (a different verb than
"encourir," different structure than "comblé de... faveurs") or whether
the resemblance is acceptable as inherent to translating a very
well-known, short, formulaic verse. I am not asserting copying; I am
flagging a resemblance close enough that Packet B's own Terminology
Question 4 anticipated exactly this kind of case, and it deserves a
specific answer rather than a general "no" by default.

---

## Lesson 1 — `al-fatiha-orientation-and-structure`

**Module title_fr**: "Al-Fatiha : une sourate complète" — `APPROUVÉ`.
**Module goal_fr**: "Étudier Al-Fatiha comme une sourate complète, en
suivant comment son sens se construit, de la louange à la demande." —
natural, faithful. `APPROUVÉ`.
**Lesson title_fr**: "Al-Fatiha : la sourate complète" — `APPROUVÉ`
(near-duplication of the module title mirrors the English original's own
pattern; not a French-introduced issue).

**Item 1 — L1-S0** (explanation, `...sql:228`)
> Vous avez déjà lu à voix haute les sept ayat d'Al-Fatiha, et au niveau 5
> vous en avez reconnu plusieurs particules grammaticales. Vous l'étudiez
> maintenant telle qu'elle est : une sourate complète, lue et comprise dans
> son ensemble plutôt que comme des lignes d'exercice séparées.

`REMPLACER PAR` : Vous avez déjà lu à voix haute les sept versets
d'Al-Fatiha, et au Niveau 5 vous en avez reconnu plusieurs particules
grammaticales. Vous l'étudiez maintenant telle qu'elle est : une sourate
complète, lue et comprise dans son ensemble plutôt que comme des lignes
d'exercice séparées.

Reasoning: "ayat"→"versets" per Finding T. "niveau 5"→"Niveau 5": every
other real content string in this app's migrations that names a level
capitalizes "Niveau" (16/16 non-placeholder instances checked); this is
the one exception, alongside item 9 below.

**Item 2 — L1-S1** (`quran_example` 1:1, `...sql:234`)
> Al-Fatiha — « l'Ouverture » — commence ici, avec le même verset qui ouvre
> le Coran lui-même.

`APPROUVÉ`. Correctly uses "verset." Em dashes rendered properly. "l'Ouverture"
is the standard French gloss for "The Opening," consistent with F4 in the
research review.

**Item 3 — L1-S2** (`...sql:241`)
> Lues ensemble, les sept ayat d'Al-Fatiha se divisent en deux parties. Les
> ayat 1 à 4 louent Allah, en disant qui Il est. Les ayat 5 à 7 se tournent
> vers une demande directe. Le tournant se produit à « Toi » dans l'ayah 5
> — la première fois que la sourate s'adresse directement à Allah au lieu
> de Le décrire.

`REMPLACER PAR` : Lus ensemble, les sept versets d'Al-Fatiha se divisent en
deux parties. Les versets 1 à 4 louent Allah, en disant qui Il est. Les
versets 5 à 7 se tournent vers une demande directe. Le tournant se produit
à « Toi » dans le verset 5 — la première fois que la sourate s'adresse
directement à Allah au lieu de Le décrire.

Reasoning: ayah/ayat→verset(s), with the required gender-agreement flip
("Lues" fem. plural → "Lus" masc. plural, since "versets" is masculine).

**Item 4 — L1-S3** (summary, `...sql:247`)
> Deux parties, sept ayat : louange (1 à 4), puis demande (5 à 7), le
> tournant se situant à l'ayah 5.

`REMPLACER PAR` : Deux parties, sept versets : louange (1 à 4), puis
demande (5 à 7), le tournant se situant au verset 5.

Reasoning: ayat→versets; "à l'ayah 5"→"au verset 5" ("verset" is masculine:
à + le = au).

**Item 5 — L1-E0 prompt** (`...sql:262`)
> Quel est le premier verset à s'adresser directement à Allah par « Toi »,
> plutôt que de Le décrire à la troisième personne ?

`APPROUVÉ`. Clear, unambiguous, correctly uses "verset," divine pronoun
correctly capitalized.

**Item 30 — L1-E0 choices** (`...sql:294`)
> Verset 2 / Verset 4 / Verset 5

`APPROUVÉ`.

**Item 6 — L1-E0 explanation** (`...sql:265`)
> Les ayat 1 à 4 décrivent Allah à la troisième personne (« Seigneur des
> mondes », « Souverain du Jour de la Rétribution »). L'ayah 5 passe à Lui
> parler directement.

`REMPLACER PAR` : Les versets 1 à 4 décrivent Allah à la troisième personne
(« Seigneur des mondes », « Maître du Jour de la rétribution »). Le verset
5 passe à s'adresser à Lui directement.

Reasoning, three separate fixes:
1. ayat/ayah→versets/verset.
2. **"Souverain du Jour de la Rétribution" → "Maître du Jour de la
   rétribution."** This is the same Arabic phrase (*Māliki yawmi d-dīn*,
   ayah 1:4) that Level 4's core-grammar migration
   (`20260907100000...sql:282`) already taught this exact learner, in
   French, as **"Maître du Jour de la rétribution"** (lowercase
   "rétribution"). Level 6's own Lesson 2 explicitly says it is building on
   what Level 4 already taught for this exact ayah — but then names it
   differently. "Souverain" is not wrong as a translation of *Malik*
   (Level 4 itself uses "Souverain" for a *different* ayah, 114:2,
   *Māliki n-nās*), but for *this specific verse*, a returning learner
   already has "Maître du Jour de la rétribution" in memory from Level 4,
   and the disputed Hamidullah source in this same database also uses
   "Maître" for 1:4 — "Souverain" is the outlier here, introduced only by
   this migration, with no stated reason to diverge. This also resolves
   Packet B's own Terminology Question 1: keep "rétribution" (matching
   established precedent) rather than switching to "Récompense."
3. "L'ayah 5 passe à Lui parler directement" — "passer à + bare
   infinitive" is not an idiomatic French construction (standard French
   uses "passer à + noun," e.g. "passer à l'action," or "se mettre à +
   infinitive"). Replaced with "passe à s'adresser à Lui directement,"
   which also matches the reflexive verb ("s'adresse") already used for
   the identical idea in item 3's own text, for internal consistency.

**Item 7 — L1-E1 prompt** (`...sql:272`)
> Les ayat 1 à 4 louent et décrivent Allah ; les ayat 5 à 7 se tournent
> vers une demande directe.

`REMPLACER PAR` : Les versets 1 à 4 louent et décrivent Allah ; les versets
5 à 7 se tournent vers une demande directe.

**Item 31 — L1-E1 explanation** (`...sql:275`)
> C'est la structure d'Al-Fatiha : d'abord la louange, puis la demande.

`APPROUVÉ`.

**Item 8 — L1-E2 matching** (`...sql:296`)
> Ayat 1 à 4 → Louange : dire qui est Allah / Ayat 5 à 7 → Demande :
> s'adresser directement à Allah / Le mot du tournant → « Toi », à l'ayah 5

`REMPLACER PAR` : Versets 1 à 4 → Louange : dire qui est Allah / Versets 5
à 7 → Demande : s'adresser directement à Allah / Le mot du tournant → « Toi
», au verset 5

Reasoning: ayat/ayah→versets/verset. I left "Le mot du tournant" as-is
rather than proposing "Le mot pivot" or "Le mot charnière" (both would read
more idiomatically) — this string doubles as a `matching` exercise's
`pair.left` review-item key, and given the migration's own collision-guard
SQL already treats these exact strings as load-bearing identifiers (see
Finding T), I did not want to bundle a purely stylistic change into a
required structural one. Flagging "Le mot du tournant" here only as a
minor, optional polish suggestion, not a required change.

---

## Lesson 2 — `al-fatiha-tracing-meaning`

**Lesson title_fr**: "Suivre le sens, verset par verset" — `APPROUVÉ`.
Correctly uses "verset," which makes the body text's drift to "ayah"
(below) more clearly an inconsistency than a deliberate choice.

**Item 9 — L2-S0** (`...sql:329`)
> L'ayah 3 n'avait encore jamais été étudiée pour son sens. Les ayat 4 et 6
> ont déjà eu leurs expressions expliquées, dans les leçons de grammaire du
> niveau 4 — mais pas la façon dont elles s'inscrivent dans la trajectoire
> propre d'Al-Fatiha, de la louange à la demande. C'est ce que vous allez
> suivre ici.

`REMPLACER PAR` : Le verset 3 n'avait encore jamais été étudié pour son
sens. Les versets 4 et 6 ont déjà eu leurs expressions expliquées, dans les
leçons de grammaire du Niveau 4 — mais pas la façon dont ils s'inscrivent
dans la trajectoire propre d'Al-Fatiha, de la louange à la demande. C'est
ce que vous allez suivre ici.

Reasoning: ayah/ayat→verset(s) with agreement flip ("étudi**ée**"→
"étudi**é**", "**elles** s'inscrivent"→"**ils** s'inscrivent," since
"versets" is masculine plural); "niveau 4"→"Niveau 4" (same capitalization
issue as item 1).

**Item 10 — L2-S1** (`quran_example` 1:3, `...sql:335`)
> L'ayah 3 reprend les deux mêmes noms d'Allah qui clôturaient l'ayah 1 —
> « le Tout Miséricordieux, le Très Miséricordieux » — cette fois comme un
> verset à part entière.

`REMPLACER PAR` : Le verset 3 reprend les deux mêmes noms d'Allah qui
clôturaient le verset 1 — « le Tout Miséricordieux, le Très Miséricordieux
» — cette fois comme un verset à part entière.

Reasoning: this sentence already uses "verset" at the end while using
"ayah" twice at the start — the clearest single-sentence instance of
Finding T's inconsistency.

**Item 11 — L2-S2** (`quran_example` 1:4, `...sql:342`)
> L'ayah 4 — « Souverain du Jour de la Rétribution » — ajoute une nouvelle
> description : l'autorité d'Allah, en particulier au Jour du Jugement.
> C'est encore de la louange, Allah étant toujours décrit à la troisième
> personne, comme dans les ayat 1 à 3.

`REMPLACER PAR` : Le verset 4 — « Maître du Jour de la rétribution » —
ajoute une nouvelle description : l'autorité d'Allah, en particulier au
Jour du Jugement. C'est encore de la louange, Allah étant toujours décrit à
la troisième personne, comme dans les versets 1 à 3.

Reasoning: same two fixes as item 6 (ayah/ayat→verset(s); Souverain→Maître
for consistency with Level 4's own rendering of this exact ayah). Per
Packet B's own note, the "still praise" interpretive framing itself tracks
whatever Packet A decides on the English (F2 in the research review); I am
only correcting the French wording of the parts that are not the disputed
interpretive question.

**Item 12 — L2-S3** (`quran_example` 1:6, `...sql:349`)
> L'ayah 6 — « Guide-nous vers le droit chemin » — est la demande vers
> laquelle la sourate se dirigeait depuis l'ayah 5. C'est la chose précise
> qui est demandée.

`REMPLACER PAR` : Le verset 6 — « Guide-nous vers le droit chemin » — est
la demande vers laquelle la sourate se dirigeait depuis le verset 5. C'est
la chose précise qui est demandée.

Reasoning: ayah→verset only. Separately: Packet B's Terminology Question 2
asked whether "C'est la chose précise qui est demandée" is the right French
match for the proposed English fix ("the specific thing being asked for").
It is — natural, faithful, and correctly avoids the exclusivity overclaim
the original "the one thing being asked for" risked. This part of the
sentence is `APPROUVÉ` as already written; only the ayah/verset terms need
changing.

**Item 13 — L2-S4** (summary, `...sql:356`)
> L'ayah 3 reprend la miséricorde d'Allah comme louange. L'ayah 4 ajoute
> Son autorité au Jour du Jugement. L'ayah 6 nomme la demande elle-même :
> être guidé sur le droit chemin.

`REMPLACER PAR` : Le verset 3 reprend la miséricorde d'Allah comme louange.
Le verset 4 ajoute Son autorité au Jour du Jugement. Le verset 6 nomme la
demande elle-même : être guidé sur le droit chemin.

Note: this section already expresses "guidance" as the verb phrase "être
guidé" rather than the noun "la guidance" — see Finding on Lesson 3 below;
this section is the model the Lesson 3 instances should match.

**Item 14 — L2-E0 prompt + explanation** (`...sql:371, 374`)
> Prompt: Qu'ajoute l'ayah 4 à la louange d'Allah dans la sourate ?
> Explanation: L'ayah 4 nomme Allah « Souverain du Jour de la Rétribution »
> — Le décrivant encore, pas encore une demande.

`REMPLACER PAR` :
Prompt : Qu'ajoute le verset 4 à la louange d'Allah dans la sourate ?
Explication : Le verset 4 nomme Allah « Maître du Jour de la rétribution »
— Le décrivant encore, pas encore une demande.

**Item 32 — L2-E0 choices** (`...sql:401`)
> Un nouveau nom pour Allah / Son autorité sur le Jour du Jugement / Une
> demande de guidance

`REMPLACER PAR` : Un nouveau nom pour Allah / Son autorité sur le Jour du
Jugement / Une demande d'être guidé

Reasoning: "la guidance" as a noun for spiritual/divine guidance is an
anglicism — French dictionaries (Larousse, Le Robert) list "guidance"
narrowly as vocational/educational/psychological counseling terminology
("guidance scolaire et professionnelle"), not the register used for divine
guidance in Islamic French writing. See the fuller note under Lesson 3.

**Item 15 — L2-E1 prompt** (`...sql:381`)
> L'ayah 6, la demande d'être guidé sur le droit chemin, est la demande
> centrale vers laquelle le reste de la sourate se dirige.

`REMPLACER PAR` : Le verset 6, la demande d'être guidé sur le droit chemin,
est la demande centrale vers laquelle le reste de la sourate se dirige.

**Item 16 / Item 33 — L2-E2 matching** (`...sql:390, 403`)
> Ayah 3 → Reprend la louange de l'ayah 1 comme verset à part entière /
> Ayah 4 → L'autorité d'Allah au Jour du Jugement / Ayah 6 → La demande de
> guidance

`REMPLACER PAR` : Verset 3 → Reprend la louange du verset 1 comme verset à
part entière / Verset 4 → L'autorité d'Allah au Jour du Jugement / Verset 6
→ La demande d'être guidé

---

## Lesson 3 — `al-fatiha-synthesis-praise-and-petition` (capstone)

**Lesson title_fr**: "Synthèse : de la louange à la demande" — `APPROUVÉ`.

**Item 17 — L3-S0** (`...sql:427`)
> Mise ensemble, Al-Fatiha avance dans une seule direction : la louange,
> puis la demande, puis une demande rendue concrète. Les ayat 1 à 4 disent
> qui est Allah. L'ayah 5 se tourne pour s'adresser à Lui directement et en
> dit la raison : l'adoration et le besoin d'aide. L'ayah 6 nomme la
> demande : la guidance. L'ayah 7 rend cette guidance concrète, par
> contraste.

`REMPLACER PAR` : Pris dans son ensemble, Al-Fatiha avance dans une seule
direction : la louange, puis la demande, puis une demande rendue concrète.
Les versets 1 à 4 disent qui est Allah. Le verset 5 se tourne pour
s'adresser à Lui directement et en donne la raison : l'adoration et le
besoin d'aide. Le verset 6 nomme la demande : être guidé. Le verset 7 rend
cela concret, par contraste.

Reasoning, three fixes:
1. **"Mise ensemble, Al-Fatiha avance..."** — "mettre ensemble" describes
   physically combining separate objects; it is not the idiom French uses
   for "taken as a whole." "Pris dans son ensemble" (or "Prise dans son
   ensemble" if agreeing with "la sourate") is the natural equivalent of
   "put together" / "taken as a whole" opening a synthesis paragraph.
2. ayat/ayah→versets/verset.
3. **"la guidance"** (used twice here) — see the note below; replaced with
   "être guidé" and the neutral pronoun "cela," matching how Lesson 2 (item
   13) already expresses the same idea, and avoiding the gender mismatch
   that a literal noun substitution would create.

**Note on "la guidance"** (affects items 17, 19, 32, 33, and the Lesson 3
capstone summary below — 7 occurrences total): "guidance" is a genuine word
in French dictionaries, but its standard sense is vocational/psychological/
educational counseling. Using it as the noun for divine guidance (hidayah)
reads as an anglicism in this register — nowhere else in the app's French
content is "guidance" used this way, and Lesson 2 itself (item 13, item 15)
already expresses the identical idea as "être guidé sur le droit chemin"
(a verb phrase), not as a noun. I recommend Lesson 3 be brought in line
with Lesson 2's own phrasing rather than introducing a new noun for the
same concept three lessons apart.

**Item 18 — L3-S1** (`quran_example` 1:7, `...sql:433`)
> Le chemin est décrit par contraste : le chemin de ceux qu'Allah a
> comblés de Ses faveurs, non celui de ceux qui ont encouru Sa colère ou
> qui se sont égarés. La demande de l'ayah 6 devient ici précise.

`REMPLACER PAR` : Le chemin est décrit par contraste : le chemin de ceux
qu'Allah a comblés de Ses faveurs, non celui de ceux qui ont encouru Sa
colère ou qui se sont égarés. La demande du verset 6 se précise ici.

Reasoning: ayah→verset; "devient ici précise" (becomes here precise) is a
slightly awkward word order — "se précise ici" (becomes more specific
here) is the more idiomatic reflexive construction and is shorter, which
helps on narrow screens. **See Finding H above** on this passage's close
resemblance to the disputed Hamidullah wording — I am not proposing a
rewrite of "comblés de... faveurs" / "encouru... colère" myself, since that
is exactly the open question Finding H raises for a human reviewer, not
something I think should be silently changed inside a straightforward
punctuation/grammar pass. On Terminology Question 3 (encouru vs. suscité):
my own judgment is that "encourir la colère de quelqu'un" is a standard,
correctly-registered French collocation (to bring consequence upon
oneself), a closer semantic match to "have earned/incurred anger" than
"susciter," which implies actively provoking — I would keep "encouru" on
pure French-register grounds, independent of Finding H's separate
resemblance concern.

**Item 19 — L3-S2** (tip, `...sql:440`)
> Remarquez la construction : la louange (qui est Allah) mène à l'adoration
> et à une demande d'aide (pourquoi nous nous tournons vers Lui), qui mène
> à la guidance (ce que nous demandons), rendue concrète par le contraste
> du chemin (ayah 7).

`REMPLACER PAR` : Remarquez la construction : la louange (qui est Allah)
mène à l'adoration et à une demande d'aide (pourquoi nous nous tournons
vers Lui), qui mène à la demande d'être guidé (ce que nous demandons),
rendue concrète par le contraste du chemin (verset 7).

Reasoning: "la guidance"→"la demande d'être guidé" (keeps "rendue" correctly
agreeing, feminine, with "la demande"); bare parenthetical "(ayah 7)" (no
article, inconsistent format vs. everywhere else in the migration, which
either says "l'ayah 7" or "le verset 7")→"(verset 7)."

**Item 20 — L3-S3** (summary, `...sql:446`)
> Sept ayat, une seule direction : la louange, puis l'adoration et l'aide,
> puis la guidance, puis le chemin lui-même.

`REMPLACER PAR` : Sept versets, une seule direction : la louange, puis
l'adoration et l'aide, puis le fait d'être guidé, puis le chemin lui-même.

**Item 21 — L3-E0 prompt** (`...sql:461`)
> Quel verset rend la demande concrète pour la première fois — que
> demandons-nous exactement à Allah de nous montrer ?
> (choices: Verset 5 / Verset 6 / Verset 7; correct: Verset 6)

`AVIS HUMAIN REQUIS` : this exercise's own correct answer (verset 6 "makes
the request concrete") sits in tension with item 18's own text two sections
earlier in the same lesson, which says "La demande du verset 6 **devient
ici précise**" — "here" meaning at verset 7, the section currently being
read. A learner who just read "the request from verset 6 becomes precise
**at verset 7**" could reasonably answer "Verset 7" to "which verset first
makes the request concrete," and be marked wrong. This tension exists
identically in the English (I checked: "The request in ayah 6 becomes
specific here" appears in the English `quran_example` 1:7 body, immediately
before an exercise whose correct answer is "Ayah 6") — so this is not a
French-introduced ambiguity, and I am not proposing my own French rewording
of the resolution, since fixing it requires deciding what the intended
distinction is (verset 6 names *what* is asked for — the path — vs. verset
7 makes *that path* concrete via contrast) and then wording both the
section and the exercise consistently in both languages together. Flagging
for the reconciliation process to route to whichever review is handling the
English exercise-design pass (Packet A's territory per the task brief),
with a note that once the English is settled the French translation of
whichever fix is chosen should be reviewed again specifically for this
tension.

**Item 22 — L3-E1 prompt** (`...sql:475`)
> L'ayah 7 rend concret le « droit chemin » de l'ayah 6 en le mettant en
> contraste avec deux autres chemins.

`REMPLACER PAR` : Le verset 7 rend concret le « droit chemin » du verset 6
en le mettant en contraste avec deux autres chemins.

**Item 23 — L3-E1 explanation** (`...sql:478`)
> L'ayah 7 met en contraste le chemin des favorisés avec deux autres : le
> chemin de ceux qui ont encouru la colère, et le chemin de ceux qui se
> sont égarés.

`REMPLACER PAR` : Le verset 7 met en contraste le chemin des favorisés avec
deux autres : le chemin de ceux qui ont encouru la colère, et le chemin de
ceux qui se sont égarés.

Reasoning: ayah→verset only; the rest is `APPROUVÉ` as written, subject to
the same Finding H note as item 18 (this sentence shares the "encouru...
colère" collocation).

**Item 34 — L3-E0 choices** (`...sql:497`)
> Verset 5 / Verset 6 / Verset 7 — `APPROUVÉ`.

**Item 24 / Item 35 — L3-E2 prompt + choices** (`...sql:485, 499`)
> Remettez le mouvement d'Al-Fatiha dans l'ordre : (A) la demande de
> guidance, (B) la louange d'Allah en tant que Seigneur des mondes, (C) le
> chemin décrit par contraste. / choices: B, A, C / A, B, C / C, B, A

`REMPLACER PAR` (prompt only) : Remettez le mouvement d'Al-Fatiha dans
l'ordre : (A) la demande d'être guidé, (B) la louange d'Allah en tant que
Seigneur des mondes, (C) le chemin décrit par contraste.

Choice strings themselves (B, A, C / A, B, C / C, B, A) are `APPROUVÉ` —
language-neutral.

---

## UI fallback strings (outside the migration, but rendered for every Level 6 `quran_example`)

**Item 36 — `quranExampleReference`** (`src/locales/fr/learning.ts:370`):
"Sourate {surah}, verset {ayah}" — `APPROUVÉ`.

**Item 37 — `quranExampleUnavailable`** (`src/locales/fr/learning.ts:371`):
"Ce verset n'a pas pu être chargé." — `APPROUVÉ`. (This is the fallback for
when the ayah row itself fails to load, e.g. network error — distinct from
item 38.)

**Item 38 — `translationUnavailable`** (`src/locales/fr/quran.ts:69`):
"Traduction française pas encore disponible pour ce verset." —
`AVIS HUMAIN REQUIS`. The string itself is natural, correct French. The
concern, per Finding K: "pas encore" ("not yet") frames this as a temporary
state that a future import will resolve. For the specific 58 ayat nulled by
migration `20260911110000` (Al-Fatiha included), and for as long as
`QuranExampleSection` never queries the Kazimirski resolver, this state is
not temporary — it cannot resolve to available without a code change, no
matter what content is imported. This is a copy-accuracy question at the
project level (does the wording need to distinguish "not yet imported" from
"not currently wired to render even when imported"?), not something I think
should be decided inside a Level 6 content review in isolation, since the
same string is shared by every level's `quran_example` blocks.

---

## What I did not find

I did not find any French string that asserts a doctrinally stronger or
more definite claim than its English counterpart — every interpretive
framing (the praise/petition division, the "still praise" characterization
of ayah 4, the "central request" language) tracks the English's own level
of assertiveness exactly. I did not find any double-negative construction
in the shipped French text (the one true/false item that had this problem
in an earlier draft, per `LEVEL6-RESEARCH-REVIEW.md` L3-E1, was already
rewritten positively in both languages before I reviewed it, and the French
version of that rewrite reads cleanly). I did not find any gender-agreement
error on the divine pronouns (Toi/Lui/Il/Son/Sa/Ses) — capitalization is
applied consistently everywhere I checked. I did not find any string I
would flag as needing outright removal (`SUPPRIMER`), and no item where I
felt a citation/source was needed before I could judge the French wording
itself (`SOURCE REQUISE`) — Terminology Questions 1–3 from the packet are
addressed with concrete recommendations above rather than left as open
sourcing gaps. I did not test rendering on an actual narrow-viewport device
and cannot substitute for that; based on string length alone, none of this
batch's French strings struck me as disproportionately longer than their
English counterparts in a way likely to overflow a fixed-width control
(the one long explanation paragraph, item 9, is a flexible-height
`explanation` card, not a button or chip).
