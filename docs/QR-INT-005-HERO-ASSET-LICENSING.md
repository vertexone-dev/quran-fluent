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

## Evidence review (QR-INT-005 release readiness)
Reviewed `QuranRoots_Final_Delivery.zip` in full (FINAL_REPORT.md, frontend/src/quranroots/README.md,
design_lock/README.md + DESIGN_LOCK_MANIFEST.json, comparison/*.md). The only statements about the art are:
"AI-generated (Gemini image model) using `01_website_homepage.png` as reference" and "confirm your licence
terms for AI imagery before commercial use" (FINAL_REPORT item 6). The package contains **no** licence file,
terms acceptance, account/product/date record, generation log, or assignment of rights. No verifiable
evidence of commercial usage rights exists in the package.

## Written confirmation required from Emergent (before these files may ship)
1. Which Google product and plan generated `hero-desktop.jpg`, `hero-mobile.jpg` (and `hero-desktop-alt.jpg`):
   consumer Gemini app, Gemini API, or Vertex AI; the account owner; the generation date(s).
2. The exact Google terms version in force at generation time, and confirmation that those terms permit
   commercial use of outputs by Emergent's customers.
3. Written confirmation that Emergent assigns or licenses to QuranRoots / VertexOne, in writing,
   all rights it holds in the files, including for the reference image they were derived from.
4. Confirmation the generation prompts/reference (`01_website_homepage.png`, itself AI-generated) did not
   include third-party copyrighted or trademarked material, and who generated that mockup under which terms.
5. Whether any indemnity is offered if a third-party claim arises (Google's terms are reported to give none).
6. Acknowledgement that prompt-only AI output may not be copyrightable (US Copyright Office, Part 2, Jan 2025),
   i.e. QuranRoots cannot expect exclusivity in this image.
Until 1-3 are received in writing, the assets stay blocked. The approved artwork has NOT been replaced.

Recorded owner decision: _pending_.
