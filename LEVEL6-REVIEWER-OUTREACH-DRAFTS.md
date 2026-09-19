# Level 6 reviewer outreach — drafts only

**Not sent. No recipients identified or authorized.** These are templates
to use once the user names who should review this and confirms contact is
authorized. Do not fill in a name, email, or send any of this without that
explicit authorization.

---

## Draft message — Qur'an-content reviewer (Packet A)

> Subject: Review needed — Level 6 Al-Fatiha lesson content (not live, draft PR)
>
> Hi [NAME],
>
> We've drafted the first Level 6 lesson content for QuranRoots — three
> short lessons studying Al-Fatiha as a complete surah, building on what
> learners already know from Levels 1 and 5. Nothing here is live or
> approved; it's a draft PR waiting on your review before anything ships.
>
> I've put together a focused packet with the specific English content and
> the two or three places where your judgment is actually needed (one is a
> real choice between two defensible scholarly framings of the surah's
> structure — sourced, not guessed). It should take [ESTIMATE] to review.
>
> Packet: LEVEL6-REVIEW-PACKET-A-QURAN-CONTENT.md
> Full research behind it: LEVEL6-RESEARCH-REVIEW.md
> Draft PR: [PR LINK]
>
> For each item, a line like "Approved as written," "Change to: ...,"
> "Needs a cited source," or "Cannot approve: [reason]" is exactly what we
> need — as terse or as detailed as you like.
>
> No rush that isn't real — this only ships once you're satisfied.
>
> Thank you,
> [SENDER]

---

## Draft message — French reviewer (Packet B)

> Subject: Révision demandée — contenu de leçon Niveau 6 sur Al-Fatiha (brouillon, non publié)
>
> Bonjour [NAME],
>
> Nous avons rédigé le premier contenu de leçon pour le Niveau 6 de
> QuranRoots — trois courtes leçons étudiant Al-Fatiha comme une sourate
> complète. Rien de tout cela n'est en ligne ni approuvé ; il s'agit d'une
> pull request en brouillon qui attend votre relecture.
>
> Le français n'est pas une citation d'une traduction coranique publiée
> (aucune traduction française gouvernée n'est disponible dans cet
> environnement) — c'est une prose pédagogique rédigée pour suivre le sens
> anglais réellement affiché à l'apprenant. Votre rôle est de juger cette
> prose en elle-même : est-elle fidèle, naturelle, et clairement distincte
> d'une citation scripturaire ?
>
> Le paquet de révision liste chaque phrase française avec son équivalent
> anglais et sa source.
>
> Paquet : LEVEL6-REVIEW-PACKET-B-FRENCH.md
> Recherche complète : LEVEL6-RESEARCH-REVIEW.md
> PR en brouillon : [LIEN PR]
>
> Pour chaque élément, une réponse du type « Approuvé tel quel », «
> Remplacer par : ... », « Nécessite une source citée », ou « Ne peut pas
> approuver : [raison] » est exactement ce dont nous avons besoin.
>
> Merci,
> [SENDER]

---

## Reviewer checklist (for whoever is identified)

Qur'an-content reviewer:
- [ ] Has read `LEVEL6-CONTENT-LEDGER.md` in full
- [ ] Has read `LEVEL6-RESEARCH-REVIEW.md` in full
- [ ] Has decided Packet A Item 1 (ayah 4 framing: Option A, Option B, or other)
- [ ] Has decided Packet A Item 2 (evoked vs. earned)
- [ ] Has given a view on Packet A Item 3 (attribution — priority/severity only, not a fix)
- [ ] Has recorded the reviewed commit SHA their decisions apply to
- [ ] Has stated final decision: Approved / Approved with changes / Not approved

French reviewer:
- [ ] Has read Packet B in full, including the "no governed French
      translation available" context
- [ ] Has reviewed all 24 French items for naturalness and fidelity to
      their English counterpart
- [ ] Has answered Terminology questions 1-4
- [ ] Has confirmed no French sentence reads as a scriptural quotation
- [ ] Has recorded the reviewed commit SHA their decisions apply to
- [ ] Has stated final decision: Approved / Approved with changes / Not approved

**Both reviewers**: if either reviewer's requested changes result in a new
commit, that commit must go back to *both* reviewers for confirmation
before final approval is recorded — approval of an earlier draft does not
carry forward to a later edit (per the task's own Stage 6 instruction).
