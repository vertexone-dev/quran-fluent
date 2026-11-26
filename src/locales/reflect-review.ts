// Release-review status of the Reflect prompt content (src/locales/*/reflect.ts).
//
// The prompts are short neutral questions that ask the reader to look for what
// they learned and how they might apply it. They contain no interpretation,
// ruling or religious explanation, and none is AI-generated at runtime. They
// were still DRAFTED by an AI assistant (the two "learned / apply" prompts and
// all French and Arabic wording of them) and have had no human review.
// Do not flip this status without recording who reviewed what: the test in
// reflect-prompts.test.ts enforces that. Ledger: docs/REFLECT-PROMPTS-REVIEW.md.
export const REFLECTION_PROMPTS_REVIEW = {
  status: "unreviewed" as "unreviewed" | "reviewed",
  required: [
    "educational review of the English prompts",
    "native-speaker review of the French prompts",
    "native-speaker review of the Arabic prompts",
    "scholarly review that no prompt implies an interpretation or ruling",
  ],
  reviewers: [] as { name: string; scope: string; date: string }[],
} as const;
