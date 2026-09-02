// Deliberately separate from the project's root vitest.config.ts (which
// only includes src/**/*.test.ts). This local prototype lives entirely
// under scripts/quran-import/kazimirski/local-prototype/ and is NOT part
// of `npm run test:unit` -- run explicitly via:
//   npx vitest run --config scripts/quran-import/kazimirski/local-prototype/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    root: import.meta.dirname,
    testTimeout: 20000,
  },
});
