# Packet A — Qur'an-content reviewer

**SUPERSEDED (2026-09-20): the product owner decided not to pursue
external qualified review and cancelled all outreach — see
`LEVEL6-REVIEWER-OUTREACH-DRAFTS.md` for that decision and
`LEVEL6-OWNER-REVIEW-CHECKLIST.md` for the reduced-scope path taken
instead. This packet was never sent to anyone and is kept only as a
historical record of the external-review path that was considered.**

**For a qualified reviewer of Qur'anic content and Islamic scholarship.**
Not sent to anyone yet — no reviewer has been identified or contacted.
Reviewed commit: `4138711`, branch `feat/level6-surah-mastery-candidate`.
Full context: `LEVEL6-CONTENT-LEDGER.md` and `LEVEL6-RESEARCH-REVIEW.md` at
the repo root (this packet is a focused extract of both, not a
replacement for either).

**What this is**: three short lessons studying Al-Fatiha as a complete
surah (English only — French is Packet B). Every ayah reference is a live
link into the app's own governed Qur'an data, not invented text. Every
claim below has been checked against a named source; none has been
approved by a qualified scholar. Your decisions are what this batch is
waiting on.

**How to respond**: for each item, reply with one of:
- `Approved as written`
- `Change to: [exact wording]`
- `Needs a cited source`
- `Cannot approve: [reason]`

---

## Item 1 — The structural claim (appears in Lessons 1, 2, and 3)

**Wording** (Lesson 1, section 2): *"Read together, Al-Fatiha's seven ayat
fall into two parts. Ayat 1 to 4 praise Allah, naming who He is. Ayat 5 to
7 turn to a direct request. The turn happens at 'You' in ayah 5 — the
first time the surah speaks directly to Allah instead of describing Him."*
Closely related wording repeats in Lesson 1's true_false/matching
exercises, Lesson 2's ayah-4 discussion, and Lesson 3's synthesis.

**What was checked**: Sahih Muslim 395 (an authentic hadith, Abu Hurayrah)
records Allah's own response to each verse of Al-Fatiha as it is recited;
His response to ayah 4 is "My servant has glorified Me" (praise-side), and
His response to ayah 5 is "This is between Me and My servant" (the
explicit dividing line). This directly supports the 4+3 framing used here.
Separately, Dr. Nazir Khan (Yaqeen Institute) discusses the grammatical
shift from third-person to second-person address beginning at ayah 5.

**What was also found**: Darul Iftaa Birmingham (Hanafi) states elsewhere:
"the first three are in praise of Allah... the last three [are] a request...
The verse in between the two sets [ayah 4] has both the features." This is
a 3+1+3 reading that treats ayah 4 as transitional, not purely praise —
different from the wording used in these lessons.

**Question for you**: Is the lessons' 4+3 framing (grounded in Sahih
Muslim 395) acceptable as written, or should ayah 4 be described as
transitional/bridging rather than as continuing praise? Two concrete
options, for you to choose or amend:

- **Option A (current wording)**: keep "It is still praise, still
  describing Allah in the third person" (Lesson 2, ayah 4 discussion).
- **Option B**: change to something like "Ayah 4 still describes Allah in
  the third person, and some readings treat it as the bridge into the
  request that follows" — softer, acknowledges the alternate framing.

---

## Item 2 — Ayah-by-ayah paraphrase accuracy

Every English paraphrase of an ayah's meaning was checked against
`ayahs.translation_en` (Saheeh International, the exact text this app's
lesson player actually displays — confirmed by reading the rendering code
directly, not assumed) and, separately, against the live `api.quran.com`
Saheeh International text. All match exactly **except one word in ayah
1:7**: this app stores "not of those who **have evoked** [Your] anger,"
while the live API currently shows "not of those who **have earned**
[Your] anger." Every other word of all 7 ayat matches exactly.

**Question for you**: Is "evoked" an acceptable paraphrase word for the
lesson to use here (Lesson 3, ayah 7 discussion), given it matches what
this app's own database and UI actually show the learner, even though it
differs by one word from the currently-live public API version of the
same named translation? Or should the lesson's wording be changed to
"earned" to match the current live translation, independent of what the
database happens to store? (This is a wording question for the lesson
text only — it does not require or propose changing the database's stored
Qur'an translation data, which is out of scope for this batch.)

---

## Item 3 — Attribution

Confirmed by reading the code directly: the lesson player's `quran_example`
blocks (used by this batch and by every prior level's lessons) show the
Arabic text, the English translation, and a "Surah N, Ayah N" reference —
**no translator or edition name, anywhere.** By contrast, the app's
separate, standalone Qur'an Reader page does show a full attribution line
for its own English text (a different translation, Pickthall).

**Question for you**: Should Level 6 (or the lesson player generally, as a
cross-cutting fix outside this batch's scope) display which translation
edition is shown? This is recorded as an open finding, not something this
batch changes unilaterally — your view on its priority/severity is
requested.

---

## Item 4 — Exercise design (not a content-accuracy question, included for completeness)

Lesson 3's second exercise is phrased as a negative claim ("Ayah 7
describes the straight path only in general terms, without contrasting it
with anything else" — correct answer: False). This has been rewritten to a
positive phrasing with the same tested knowledge ("Ayah 7 makes the
'straight path' concrete by contrasting it with two other paths" — correct
answer: True) as a safe, non-interpretive fix already applied on this
branch (see Stage 5 of the task report). Flagged here only so you know it
changed and why; no decision needed from you on this one.

---

## Context: a real error was found and fixed during review, not by you

An adversarial re-check found that Lesson 2 originally overclaimed that
ayat 1:4 and 1:6 had "never" had their meaning addressed anywhere in the
curriculum — false: Level 4's grammar lessons already glossed both
phrases (teaching agreement and the *iḍāfa* construction, not the surah's
structure). This has already been corrected directly in the lesson text,
the migration, and the ledger (see `LEVEL6-RESEARCH-REVIEW.md` Finding
F5) — you're seeing the corrected version. Flagged here only so you have
the full picture, not because it needs your decision.

## Summary of what needs your judgment

1. Item 1 (ayah 4's framing) — a real choice between two defensible,
   sourced readings.
2. Item 2 (evoked vs. earned) — a wording-vs.-data-fidelity question.
3. Item 3 (attribution) — a scope/priority question, not this batch's to
   decide alone.

Everything else in the three lessons' English content was independently
verified against `ayahs.translation_en` and/or a named source and found to
match exactly, with no unsupported claim identified. That does not
substitute for your sign-off — it means your sign-off is the only thing
standing between this content and production readiness.
