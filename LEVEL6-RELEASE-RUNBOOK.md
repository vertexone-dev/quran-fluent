# Level 6 ("Surah Mastery") — Controlled Release Runbook

**Status as of this document's introduction: not started.** Level 6 is
disabled in production. This runbook exists to make the eventual release
auditable and reversible, not to authorize it — every step that touches
production requires its own explicit, separate authorization from the
product owner (Moubarak Akamou), even once this PR itself is approved and
merged.

**This release rests on product-owner editorial approval only** (see
`LEVEL6-OWNER-REVIEW-CHECKLIST.md`) — not qualified Islamic-studies review,
not independent scholarly approval, not independent professional French
review. The disclaimer that document carries applies here without
modification: *"Owner editorial review only. No qualified Islamic-studies
review or independent professional French review was obtained. AI analysis
was advisory and does not constitute human scholarly approval."* Deferred
matters recorded there (ayah 4's classification; "evoked" vs. "earned";
translator attribution; the Kazimirski-never-renders code gap) remain
deferred by this runbook, not resolved by it.

---

## Required sequence (exact order — do not reorder or skip a step)

### 1. PR checks pass
The release PR (`release/level6-surah-mastery` → `main`) must show the
required `test` status check green, per the `Protect main` ruleset
(`strict_required_status_checks_policy: true` — branch must be up to date
with `main` at the time checks run).

### 2. Required independent GitHub approval is recorded
The `Protect main` ruleset requires `required_approving_review_count: 1`
with `dismiss_stale_reviews_on_push: true`. This approval is a normal
GitHub code-review approval on the PR — it is **not** a substitute for, and
does not itself constitute, qualified Islamic-studies or French-language
review. It reviews the code/test/documentation changes in this PR (the
activation wiring, its regression coverage, and this runbook), which is a
narrower thing than reviewing Level 6's content.

### 3. Keep the release PR unmerged and Level 6 wiring inactive in production
Do not merge yet. At this point, `main` still has no
`STEP_LEVEL_SLUGS.surah_mastery` entry, so production remains exactly as
it is today regardless of how many approvals this PR collects.

### 4. Obtain explicit product-owner authorization to apply the reviewed Level 6 migration
A distinct authorization from step 2's code-review approval. Must name:
the exact migration file
(`supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`),
the exact commit it's part of, and that the owner understands this makes
the reviewed content structurally present in production (though still
unreachable by learners until the separate merge+deploy in steps 9–10).

### 5. Back up / record pre-migration production row counts
Read-only, before touching anything. Minimum required counts (via the
project's standard read-only query process, matching how this runbook's
own Phase-1-style verification already works):

```sql
select count(*) from public.levels;                -- expect 6
select count(*) from public.modules;                -- expect 23 (pre-Level-6-content)
select count(*) from public.lessons;                -- expect 58
select count(*) from public.lesson_sections;        -- expect 300
select count(*) from public.lesson_exercises;       -- expect 236
select count(*) from public.word_frequency;         -- expect 20
select count(*) from public.modules where level_id = (
  select id from public.levels where number = 6
);                                                   -- expect 0
```

These are exactly the migration's own precondition assertions (see its
opening `DO $$ ... $$` block) — this runbook mirrors them rather than
restating them independently, so the two can never silently drift apart.
If any of these does not match, **stop**: either the migration's own
preconditions will refuse to apply (safe, self-enforcing), or production
has drifted from what this runbook assumes and needs investigation before
proceeding regardless.

Record the actual returned values, not just the expected ones, alongside a
timestamp, before proceeding to step 6.

### 6. Apply only the reviewed Level 6 migration through the repository's approved production Supabase process
Whatever this repository's existing, established mechanism is for applying
a single named migration to the production Supabase project (per
`DEPLOYMENT.md`'s own documented process — this runbook does not invent a
new one). Apply **only**
`supabase/migrations/20260918100000_401cbe5f-34e3-436a-854a-e95282f5c733.sql`
— every other migration is already applied to production (confirmed by
every prior Level 6 investigation this project has done: production is
current on all migrations up to, but not including, this one). Do not
touch governed Qur'an text or translation rows as part of this or any
other step — this migration itself declares, and this runbook reaffirms,
that it does not touch `levels`, `level_translations`, Levels 1–5, or any
governed Qur'an/translation row.

### 7. Verify exact production postconditions, read-only
Query production directly (read-only) and confirm every one of the
following, by exact value, not by "looks about right" — these are exactly
the migration's own postcondition assertions (see its closing
`DO $$ ... $$` block), mirrored here rather than restated independently so
the two can never silently drift apart:

```sql
select count(*) from public.levels;                -- expect 6 (unchanged)
select count(*) from public.modules;                -- expect 24 (23 + 1)
select count(*) from public.lessons;                -- expect 61 (58 + 3)
select count(*) from public.lesson_sections;        -- expect 313 (300 + 13)
select count(*) from public.lesson_exercises;       -- expect 245 (236 + 9)
select count(*) from public.word_frequency;         -- expect 20 (unchanged)
```

- **One** Level 6 module (`al-fatiha-surah-study`) under `levels.number=6`.
- **Three** lessons under it, in this exact order:
  `al-fatiha-orientation-and-structure`,
  `al-fatiha-tracing-meaning`,
  `al-fatiha-synthesis-praise-and-petition`.
- **13** `lesson_sections` and **9** `lesson_exercises` under those three
  lessons — **2** of the 9 exercises are `matching` type (Lessons 1 and 2
  only), **0** in the capstone lesson, and **0** `reading_check` exercises
  anywhere in the batch.
- Every new module/lesson/section/exercise has **exactly** `en` and `fr`
  rows in the corresponding `*_translations` table — no more, no fewer,
  and zero rows in any other locale.
- **Levels 1–5 unchanged**: the deltas above (+1 module, +3 lessons, +13
  sections, +9 exercises) must be **exactly** and **only** Level 6's own
  new rows — re-run the exact step-5 queries and confirm nothing else grew
  or shrank. Any unexpected delta anywhere outside Level 6's own new rows
  is a stop-and-investigate event, not something to wave through.
- **Al-Fatiha (Surah 1) citation count**: exactly 32 `lesson_sections` and
  exactly 15 `lesson_exercises` reference `surah_number = 1` after this
  migration (27 pre-existing `lesson_sections` + this batch's 5 new
  citations: 1:1, 1:3, 1:4, 1:6, 1:7; this batch adds zero new
  surah/ayah-referencing exercises) — confirms no other surah was touched
  and no existing citation was removed.
- **Migration recorded exactly once** in Supabase's own migration-history
  tracking (`supabase_migrations.schema_migrations` or the CLI's own
  `supabase migration list --linked` output) — confirms it was not
  partially applied, double-applied, or applied out of the normal
  migration-tracking path.

### 8. If migration verification fails, stop
Do not merge the activation PR. Do not attempt to "fix forward" by editing
production data directly. Escalate to the product owner with the exact
postcondition query results that failed, and treat this as a genuine
incident requiring its own investigation before any further step in this
runbook proceeds.

### 9. After successful migration verification, merge the protected release PR normally
Standard merge through the GitHub UI/API, respecting `Protect main`'s full
rule set (PR, ≥1 approval, resolved conversations, up-to-date branch,
passing `test` check). **Never with `--admin`, a bypass actor, or any other
mechanism that skips the ruleset**, regardless of how much time pressure
exists at this point in the sequence.

### 10. Allow the approved production deployment pipeline to deploy the activation wiring
`production-deploy.yml` triggers automatically once `QuranRoots CI`
succeeds on `main` (or can be dispatched manually for the exact merged
SHA). Let this run through its own existing, already-verified process —
do not hand-deploy, do not skip its own post-deployment validation job.

### 11. Perform authenticated production verification of Level 6, in English and French, at 390×844, 768×1024, and 1440×900
Using the real, designated production test account (never a shared learner
account), sign in and manually verify Level 6 end-to-end, in both
languages, at all three viewports.

### 12. Confirm, specifically
- Gating: Level 6 is locked for an account that has not completed Level 5,
  and becomes available (real link, not just a label) for one that has.
- Entry: the first lesson opens correctly from the learning path.
- Lesson progression: all three lessons open, in order, with real content.
- Exercises: each of the 9 exercises grades correctly (right answer =
  correct feedback, wrong answer = incorrect feedback).
- Resume: reloading mid-lesson resumes at the same step, not the
  beginning.
- Completion: finishing all three lessons shows the expected completion
  state and (for Lessons 1–2 only) seeds exactly 3 review items each,
  zero for the capstone.
- Return to path: exiting a lesson returns to `/learning-plan` with
  Level 6's own state reflected correctly.
- Arabic typography: every Qur'anic Arabic string renders `dir="rtl"
  lang="ar"`, using the real governed text (never invented).
- Scrolling/overflow: zero horizontal overflow at all three viewports, in
  both languages.

### 13. Record final deployed SHA, migration evidence, workflow results, and production screenshots
Exactly the same standard of evidence this project has already used for
every prior deployment investigation this session — the deployed SHA
confirmed via the deploy job's own "Confirm checked-out commit matches the
validated SHA" step (not inferred from a green summary), the migration's
own postcondition query results from step 7, the `QuranRoots CI` and
`Production Deployment` workflow run IDs/conclusions, and the screenshots
from step 11–12.

---

## Rollback / containment guidance

- **If the migration succeeds (step 6/7) but deployment fails (step 10)**:
  Level 6 remains hidden — the activation wiring was never deployed, so
  `STEP_LEVEL_SLUGS.surah_mastery` is still absent from whatever code is
  actually live. No containment action needed beyond fixing and re-running
  the deployment; the migrated-but-unwired database rows are inert (as
  they already are today) until a successful deploy of the merged PR.
- **If post-deployment Level 6 validation (steps 11–12) fails**:
  Immediately prepare a focused, minimal PR that removes only the
  `STEP_LEVEL_SLUGS.surah_mastery` entry from `src/lib/placement.ts` (the
  same shape as PR #32's original containment fix), get it through the
  normal `Protect main` process (checks + approval, no bypass), merge, and
  let it deploy. **Do not delete learner progress, do not run a
  destructive rollback against production data, and do not revert the
  migration itself** — the underlying content rows are not the problem in
  this scenario (they were already verified correct in step 7); the
  problem is something in the deployed *code* path, and re-hiding the
  activation wiring is the narrow, reversible fix, exactly as it already
  was once before in this project's own history.
- **Never manually edit governed Qur'an content in production**, at any
  point in this runbook or in any containment response to it. If content
  itself is found to be wrong after release, that is a new, separate,
  properly-reviewed content-correction PR — not a live data edit.

---

## What this runbook does not authorize

Creating, updating, or even fully executing every step described here in
a *rehearsal* sense (locally, against the isolated test Supabase stack)
does not constitute authorization to run steps 4–13 against production.
Each of those remains gated behind the explicit, separate product-owner
authorization named in step 4, and behind the protected-`main` ruleset's
own requirements for steps 9–10. This document is a plan, not a standing
authorization.
