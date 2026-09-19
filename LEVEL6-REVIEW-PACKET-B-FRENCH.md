# Packet B — French reviewer

**For a qualified French-speaking reviewer.** Not sent to anyone yet — no
reviewer has been identified or contacted. Reviewed commit: `4138711`,
branch `feat/level6-surah-mastery-candidate`. Full context:
`LEVEL6-CONTENT-LEDGER.md` and `LEVEL6-RESEARCH-REVIEW.md` at the repo
root.

**Important context you need**: this app has no governed French Qur'an
*translation* available in this environment (Kazimirski, 1869, is present
only in production, via a separate import process — local and CI
databases have zero rows for it). So none of the French text below is a
quotation of any published French Qur'an translation. Every French
sentence is **independently authored, deliberately literal, pedagogical
prose** written to track the English wording actually shown to the learner
(Saheeh International, via `ayahs.translation_en`) word-for-word, rather
than adopting the phrasing of any specific French translation tradition
(e.g. Hamidullah, Kazimirski, or others). Your job is to judge this prose
on its own terms: is it accurate to the English it's tracking, natural
French, and clearly distinct from a claim to be quoting scripture.

**How to respond**: for each item, reply with one of:
- `Approved as written`
- `Change to: [exact wording]`
- `Needs a cited source`
- `Cannot approve: [reason]`

---

## Full section-by-section French text, with its English counterpart and source

### Lesson 1 — Al-Fatiha : la sourate complète

| # | French | English counterpart | Source for the underlying claim |
|---|---|---|---|
| 1 | Vous avez déjà lu à voix haute les sept ayat d'Al-Fatiha, et au niveau 5 vous en avez reconnu plusieurs particules grammaticales. Vous l'étudiez maintenant telle qu'elle est : une sourate complète, lue et comprise dans son ensemble plutôt que comme des lignes d'exercice séparées. | "You have already read all seven ayat of Al-Fatiha aloud, and in Level 5 you recognized several of its grammatical particles..." | Factual (this app's own Level 1/5 content, independently verified) |
| 2 | Al-Fatiha — « l'Ouverture » — commence ici, avec le même verset qui ouvre le Coran lui-même. | "Al-Fatiha -- 'The Opening' -- begins here..." | "The Opening" is the standard, attested English translation of the surah's name (Wikipedia, citing the Arabic root *f-t-ḥ*) |
| 3 | Lues ensemble, les sept ayat d'Al-Fatiha se divisent en deux parties. Les ayat 1 à 4 louent Allah, en disant qui Il est. Les ayat 5 à 7 se tournent vers une demande directe. Le tournant se produit à « Toi » dans l'ayah 5 — la première fois que la sourate s'adresse directement à Allah au lieu de Le décrire. | "...Ayat 1 to 4 praise Allah... The turn happens at 'You' in ayah 5..." | Sahih Muslim 395 (hadith) + Yaqeen Institute (Dr. Nazir Khan) — see Packet A Item 1; this is the same disputed framing, English side |
| 4 | Deux parties, sept ayat : louange (1 à 4), puis demande (5 à 7), le tournant se situant à l'ayah 5. | Restates #3 | Same as #3 |
| 5 | Quel est le premier verset à s'adresser directement à Allah par « Toi », plutôt que de Le décrire à la troisième personne ? | "Which ayah is the first to address Allah directly as 'You'..." | Same as #3 |
| 6 | Les ayat 1 à 4 décrivent Allah à la troisième personne (« Seigneur des mondes », « Souverain du Jour de la Rétribution »). L'ayah 5 passe à Lui parler directement. | "Ayat 1-4 describe Allah in the third person ('Lord of the worlds', 'Sovereign of the Day of Recompense')..." | Direct translation of the exact quoted English, which is itself verified verbatim against Saheeh International (see below, Terminology question 1) |
| 7 | Les ayat 1 à 4 louent et décrivent Allah ; les ayat 5 à 7 se tournent vers une demande directe. | Restates #3 | Same as #3 |
| 8 | Associez chaque partie d'Al-Fatiha à ce qu'elle fait. / Ayat 1 à 4 → Louange : dire qui est Allah / Ayat 5 à 7 → Demande : s'adresser directement à Allah / Le mot du tournant → « Toi », à l'ayah 5 | matching exercise | Same as #3 |

### Lesson 2 — Suivre le sens, verset par verset

| # | French | English counterpart | Source |
|---|---|---|---|
| 9 | L'ayah 3 n'avait encore jamais été étudiée pour son sens. Les ayat 4 et 6 ont déjà eu leurs expressions expliquées, dans les leçons de grammaire du niveau 4 — mais pas la façon dont elles s'inscrivent dans la trajectoire propre d'Al-Fatiha, de la louange à la demande. C'est ce que vous allez suivre ici. | "Ayah 3 has never been studied for its meaning before now. Ayah 4 and ayah 6 had their individual phrases explained already, in Level 4's grammar lessons..." | Corrected after an adversarial re-check found the original wording overclaimed (Level 4 had already glossed 1:4/1:6 — see `LEVEL6-RESEARCH-REVIEW.md` Finding F5). Please review this replacement text specifically for naturalness. |
| 10 | L'ayah 3 reprend les deux mêmes noms d'Allah qui clôturaient l'ayah 1 — « le Tout Miséricordieux, le Très Miséricordieux » — cette fois comme un verset à part entière. | "...'the Entirely Merciful, the Especially Merciful'..." | Direct rendering; English verified verbatim against Saheeh International |
| 11 | L'ayah 4 — « Souverain du Jour de la Rétribution » — ajoute une nouvelle description... C'est encore de la louange, Allah étant toujours décrit à la troisième personne, comme dans les ayat 1 à 3. | "...'Sovereign of the Day of Recompense'... It is still praise..." | Same disputed framing as Packet A Item 1 — **your approval of the French should track whatever English wording is ultimately approved, not be decided independently of it** |
| 12 | L'ayah 6 — « Guide-nous vers le droit chemin » — est la demande vers laquelle la sourate se dirigeait depuis l'ayah 5. C'est la seule chose demandée. | "...'Guide us to the straight path'... is the one thing being asked for." | See Terminology question 2 below — English side flagged for a precision edit already |
| 13 | L'ayah 3 reprend la miséricorde d'Allah comme louange. L'ayah 4 ajoute Son autorité au Jour du Jugement. L'ayah 6 nomme la demande elle-même : être guidé sur le droit chemin. | summary, restates above | Same as above |
| 14 | Qu'ajoute l'ayah 4 à la louange d'Allah dans la sourate ? / L'ayah 4 nomme Allah « Souverain du Jour de la Rétribution » — Le décrivant encore, pas encore une demande. | exercise + explanation | Same as #11 |
| 15 | L'ayah 6, la demande d'être guidé sur le droit chemin, est la demande centrale vers laquelle le reste de la sourate se dirige. | "...is the central request..." | Same precision question as #12 |
| 16 | Associez chaque verset à ce qu'il fait. / Ayah 3 → Reprend la louange de l'ayah 1... / Ayah 4 → L'autorité d'Allah au Jour du Jugement / Ayah 6 → La demande de guidance | matching exercise | — |

### Lesson 3 — Synthèse : de la louange à la demande

| # | French | English counterpart | Source |
|---|---|---|---|
| 17 | Mise ensemble, Al-Fatiha avance dans une seule direction : la louange, puis la demande, puis une demande rendue concrète... | full-arc synthesis | Same as Packet A Item 1 |
| 18 | Le chemin est décrit par contraste : le chemin de ceux qu'Allah a comblés de Ses faveurs, non celui de ceux qui ont encouru Sa colère ou qui se sont égarés. | "...not the path of those who have evoked anger or gone astray." | See Terminology question 3 below — a specific word-choice question for you |
| 19 | Remarquez la construction : la louange... mène à l'adoration et à une demande d'aide... qui mène à la guidance..., rendue concrète par le contraste du chemin (ayah 7). | tip, restates the arc | — |
| 20 | Sept ayat, une seule direction : la louange, puis l'adoration et l'aide, puis la guidance, puis le chemin lui-même. | summary | — |
| 21 | Quel verset rend la demande concrète pour la première fois — que demandons-nous exactement à Allah de nous montrer ? | exercise | — |
| 22 | L'ayah 7 décrit le droit chemin seulement en termes généraux, sans le mettre en contraste avec autre chose. | This exact English phrasing has already been replaced on this branch (double-negative exercise-design issue, not a translation issue — see Packet A Item 4). **The French needs the same replacement once the English is finalized**: proposed "L'ayah 7 rend concret le « droit chemin » de l'ayah 6 en le mettant en contraste avec deux autres chemins." Please review this proposed French replacement specifically. |
| 23 | L'ayah 7 met en contraste le chemin des favorisés avec deux autres : le chemin de ceux qui ont encouru la colère, et le chemin de ceux qui se sont égarés. | explanation | Same word-choice question as #18 |
| 24 | Remettez le mouvement d'Al-Fatiha dans l'ordre : (A) la demande de guidance, (B) la louange d'Allah en tant que Seigneur des mondes, (C) le chemin décrit par contraste. | sequencing exercise | — |

---

## Terminology questions specific to French

**1. "Souverain du Jour de la Rétribution"** for "Sovereign of the Day of
Recompense" — is "Rétribution" the right register here, or would
"Récompense" (more narrowly positive) or another established French
Qur'anic term be preferable? No specific French Qur'an translation is
being quoted, so this is open to your preference, subject to staying a
faithful, natural rendering of "Recompense."

**2. "C'est la seule chose demandée" / "la demande centrale"** for "the one
thing being asked for" / "the central request" — the English side has an
identified precision issue (ayah 5 also contains a request — see Packet A,
and the research review's L2-S3 finding). Once English Item 2's wording is
finalized (proposed: "the specific thing being asked for"), please review
whether "la chose précise qui est demandée" is the right French match, or
propose your own.

**3. "ont encouru Sa colère"** for "have evoked [Your] anger" — "encourir"
(to incur/bring upon oneself) arguably tracks the *current live* Saheeh
International wording ("have **earned** anger") more closely than it
tracks this app's own stored wording ("have **evoked** anger" — see Packet
A Item 2). If Packet A's reviewer keeps "evoked," would you keep
"encouru," or is there a French word that tracks "evoked" specifically
(e.g., "suscité") that you would prefer? This is a genuine, fine-grained
question, not a hidden error.

**4. General check**: does any French sentence above read as if it could
be mistaken for a direct quotation from a published French Qur'an
translation (Hamidullah, Kazimirski, or another), rather than as
independently-authored pedagogical prose? If so, please flag exactly which
sentence and suggest how to make the distinction clearer.

---

## Summary of what needs your judgment

- Items 22/#3 word-choice (encouru vs. suscité) — Terminology question 3.
- Item 11/#14 — should track whatever Packet A decides on the ayah-4
  framing.
- Item 12/#15 — the "one thing"/"central request" precision question,
  paired with Packet A.
- General naturalness/idiom pass across all 24 items — your primary task.
