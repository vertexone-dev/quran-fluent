# Reflect prompts: content and review ledger

**Status: UNREVIEWED. Not release-approved.** Marked in code by `REFLECTION_PROMPTS_REVIEW`
(`src/locales/reflect-review.ts`); a test keeps it `unreviewed` until a reviewer is recorded.

## What the feature is

On `/reflect?surah=..&ayah=..` the page shows three clearly separate things:

1. **From the Qur'an**: the Arabic exactly as stored and the reader's translation, in a framed panel.
2. **A reflection prompt**, labelled "Reflection prompt · not part of the Qur'an": one neutral question and a row of
   chips that swap the question. A note says prompts are starting questions, not interpretations or rulings.
3. **Your reflection**: the reader's own words, saved to the existing `notes` table, with a statement that it is private
   to their account.

No new table, column or migration. No AI is called at runtime and no explanation of any ayah is generated or shown.
The feature is free.

## Privacy

Reflections are rows in `public.notes`, protected by row-level security (`notes_own`: `auth.uid() = user_id`), and are not
shown to other users. The wording promises exactly that ("not shared or shown to other users") and does not claim
encryption or that operators cannot read the data. `tests/e2e/security.spec.ts` already checks that another user cannot
read, insert or update another user's notes.

## Offline

The website needs a connection to save and read reflections; it has no offline mode. The mobile app keeps reflections on
the device, so it works offline; its Reflect screen was **not changed** in this phase (it deliberately shows one prompt and
no topic chips, a QR-DESIGN-007 decision).

## The prompts (English; French and Arabic are in `src/locales/{fr,ar}/reflect.ts`)

| Label              | Prompt                                                       | Origin              |
| ------------------ | ------------------------------------------------------------ | ------------------- |
| (default)          | How does this verse speak to my life today?                  | existing            |
| What I learned     | What did you learn or notice in this ayah today?             | **new, AI-drafted** |
| How I may apply it | How might you apply what you learned in your own life?       | **new, AI-drafted** |
| Gratitude          | What blessing does this ayah remind you to be grateful for?  | existing            |
| Patience           | Where in your life could this ayah help you be more patient? | existing            |
| Trust in Allah     | How can this ayah strengthen your trust in Allah today?      | existing            |
| Daily Practice     | What is one small action you can take today from this ayah?  | existing            |

The four topical prompts predate this phase; their review status is also unrecorded. Note that the topical chips steer a
reader toward a theme for the ayah, which the mobile design decision chose to avoid; that is a product choice for the owner.

## Required before release

- [ ] Educational review of the English prompts
- [ ] Native-speaker review of the French prompts
- [ ] Native-speaker review of the Arabic prompts
- [ ] Scholarly review that no prompt implies an interpretation or ruling
- [ ] Record each reviewer, scope and date in `REFLECTION_PROMPTS_REVIEW.reviewers`, then set `status: "reviewed"`

`src/locales/reflect-prompts.test.ts` is a coarse shape guard (questions only, same set in every language, no ruling-style
wording, no Arabic in English/French prompts). It is not a review and cannot judge theological soundness. No independent
scholarly, linguistic or legal approval is claimed.
