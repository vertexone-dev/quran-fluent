# QR-INT-005 hero artwork -- commercial-rights review

Status: **BLOCKED FROM PRODUCTION.** Do not merge to `main`/deploy while these files are referenced.

Assets: `public/quranroots-hero-cinematic-desktop.jpg`, `public/quranroots-hero-cinematic-mobile.jpg`
(from Emergent's `QuranRoots_Final_Delivery.zip`, `frontend/public/assets/art/hero-desktop.jpg` / `hero-mobile.jpg`).

## What is known
- The delivery's own README/FINAL_REPORT state the art is AI-generated ("Gemini image model"), derived
  from the Design Lock mockup `01_website_homepage.png`, and say to "confirm your licence terms for AI
  imagery before commercial use".
- Not recorded anywhere: which Google account/product (consumer Gemini app, Gemini API, Vertex AI) or
  which date/terms version produced the files, and who holds that account. Emergent, not QuranRoots,
  ran the generation.
- Public summaries of Google's terms disagree on whether outputs carry an explicit commercial grant,
  and report no IP indemnity; Google's own current terms were not retrievable here. Gemini outputs
  also carry SynthID provenance marking.
- US Copyright Office (Part 2, Jan 2025): prompt-only AI output is generally not copyrightable, so
  QuranRoots could not expect exclusive rights in this image even if use were permitted.
- The source mockup is itself an AI-generated reference, so a separate derivative-of-reference
  question exists.

## Conclusion
Commercial-use rights **cannot be established** from available evidence. Treated as unlicensed.

## Approved alternatives (owner to choose)
1. **Existing approved asset (no new rights question):** `public/quranroots-hero-premium*` (the
   already-shipped sunlit-archway Qur'an photo). Zero legal risk, lower drama; the cinematic layout
   works with it (swap the two `<picture>` sources in `src/routes/index.tsx`).
2. **Commission or license real photography** of an arched window / sunset landscape with written
   commercial terms (stock license or work-for-hire).
3. **Regenerate under an owner-controlled paid account** whose terms are read and archived at
   generation time (record account, product, date, terms URL/version in this file).

Recorded owner decision: _pending_.
