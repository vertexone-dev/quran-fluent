# zod: remaining advisory, reachability, mitigation and native zod 4 migration plan

Status: **zod 3.25.76 is retained temporarily** (owner decision, QR-DESIGN-008A). `npm audit` still lists it
as 1 high finding, and that is the true state: nothing here hides it.

## The advisory

GHSA-mrhx-c7xc-m3w5, affected range `< 4.6.6`: memory/CPU exhaustion when a **collection schema
(array, set, map, tuple) validates a very large untrusted collection**, because the issue list grows with
the number of invalid elements. Fixed only in the zod 4 implementation (4.6.6+).

## Demonstrated vulnerable behaviour (measured, not assumed)

Input: a 1,000,000-element array validated against `z.array(z.string()).max(10)`.

| Implementation                                        | Issues produced | Time    |
| ----------------------------------------------------- | --------------- | ------- |
| zod 3.25.76, `import { z } from "zod"` (what we ship) | 1,000,001       | ~340 ms |
| zod 3.25.76, `zod/v4`                                 | 1,000,001       | ~760 ms |
| zod 4.6.7 imported as `zod/v3`                        | ~1,000,000      | similar |
| zod 4.6.7 native (`zod`, `zod/v4`)                    | 1               | < 1 ms  |

The third row is why the **`zod/v3` compatibility import is rejected**: it makes `npm audit` report 0 findings
but leaves the vulnerable behaviour in place (branch `experiment/qr-security-003-zod-v3-rejected`, kept as evidence,
never to be merged). A clean audit obtained that way would be misleading.

## Current application reachability

Assessment: **not reachable from untrusted input today.**

- zod is imported in exactly 5 files, all `validateSearch` schemas for URL search params
  (`auth`, `quran`, `quran_.understand`, `_authenticated/memorize`, `_authenticated/reflect`).
- Those schemas contain only `z.enum`, `z.number().int().positive()` and `.optional()/.catch()`: **no array, set,
  map, record or tuple schema exists** anywhere in `src/`.
- Measured: a 1,000,000-element array supplied for a `number` field of those schemas produces **1 issue in 0 ms**.
- The input is a URL query string, bounded by the request-line limit, so the element count cannot approach
  the millions the advisory needs.
- Server code (`src/lib/billing`, `src/integrations/supabase`) does not use zod. Billing handlers are plain
  handlers; the Stripe webhook verifies a signature over the raw body.
- A second copy, zod 4.6.7, is a dependency of `@tanstack/router-plugin` / `start-plugin-core`. It is build
  tooling, not part of the deployed Worker.

Limits of this assessment: it covers the code at this commit. It is a code reading plus measurements, not proof
that no future change introduces a collection schema; that is what the mitigations below are for.

## Mitigation requirements while zod 3 is retained

1. **No collection schemas on untrusted input.** Enforced by a test,
   `src/lib/zod-no-collection-schemas.test.ts`, which fails if `z.array/set/map/record/tuple` (or `.array()`) appears in
   `src/`. To use one, first either migrate to zod 4 or add a hard length check **before** parsing
   (`.max()` alone does not help: it still builds a million issues).
2. Bound the size of any request body before it reaches a validator.
3. Keep `npm audit` visible in CI; do not add a suppression for this advisory.
4. Re-assess if a dependency starts validating request bodies with its own zod.

## Native zod 4 migration plan (separate work, not started)

Goal: `zod` `^4.6.6` (exact pin, as the other security updates), imported as `zod` (v4 API), audit clean for the
right reason, no change in user-visible behaviour.

Known obstacle (found in QR-SECURITY-003): zod 4's `.catch()` changes the schema's _input_ type, so TanStack Router
types `/auth` `search` as required and `ProfileMenu.tsx` fails to compile at its `navigate` call. Other
`.optional().catch(...)` fields are exposed the same way.

Steps:

1. Branch from the website consolidation. Add a table of every schema and its malformed-input behaviour today
   (what `?mode=bogus`, `?surah=abc`, `?surah=-1`, `?tab=x` render).
2. Write characterization tests first (Playwright `public` project, signed-out routes): each bad value falls back
   exactly as now. Mutation-check them.
3. Bump zod. Resolve the typing obstacle. Options to evaluate, none verified yet:
   a. keep `.catch()` and give routes an explicit input type so `navigate` does not require the field;
   b. replace `.catch(x)` with `.default(x)` plus a pre-step that drops invalid values;
   c. TanStack's zod adapter (`fallback()` + `zodValidator`): adds a dependency, which needs its own review.
4. `tsc`, ESLint, unit, the full Playwright suite on the final commit.
5. Re-run the 1M-element measurement against the installed version and require 1 issue.
6. `npm audit`: expect zod gone. If it is not, stop.

Acceptance: audit clean, behaviour tests unchanged, the measurement shows the fix is active, no `zod/v3` import.
Estimated size: 5 route files plus tests; the risk is router typing, not logic.
Rollback: revert the commit; zod 3.25.76 is a one-line lockfile restore.
