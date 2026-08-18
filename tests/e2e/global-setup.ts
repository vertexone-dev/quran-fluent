import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createFreshTestUserClient, resetTestUserData } from "./utils/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

/**
 * Runs once, before every project (including "public"). Resets the shared
 * test account's data — critically, its interface_language — so specs that
 * assert on English copy (most of "public") don't inherit French from a
 * prior run that got interrupted mid-09-localization.spec.ts. Uses its own
 * throwaway sign-in; see utils/db.ts for why that must never be the session
 * other specs share.
 */
export default async function globalSetup() {
  const { client, userId } = await createFreshTestUserClient();
  await resetTestUserData(client, userId);
  await client.auth.signOut();
}
