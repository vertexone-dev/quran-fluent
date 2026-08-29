#!/usr/bin/env node
// Recreates the shared local E2E test account after `supabase db reset
// --local` wipes it — the local stack has no seed.sql that provisions an
// auth user. Idempotent: safe to run whether or not the account already
// exists. LOCAL-ONLY by construction: the service-role key it uses comes
// exclusively from `supabase status`, which only ever reports the
// CLI-managed local stack — there is no argument or config path that can
// point this script at a remote/production project. A hard guard on the
// resolved API URL below is defense in depth on top of that.
//
// Usage: node scripts/e2e/ensure-local-test-user.mjs
// (or: npm run test:e2e:setup)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function readEnvTest() {
  const envPath = path.join(repoRoot, ".env.test");
  const text = readFileSync(envPath, "utf8");
  const vars = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

function getLocalSupabaseStatus() {
  const raw = execFileSync("supabase", ["status", "-o", "json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

/**
 * The GoTrue admin `/admin/users` endpoint has no server-side email filter
 * (an `?email=` query param is silently ignored and returns the full,
 * unfiltered, unstably-ordered user list) — confirmed directly against the
 * local stack, not assumed. The only supported lookup is paginated listing
 * (`page`/`per_page`), so every page must be inspected and matched against
 * `email` client-side. A page short of `per_page` (including zero results)
 * reliably signals there is no further page — verified directly: requesting
 * a page far beyond the last one returns an empty array, not an error or a
 * repeat of prior data — so this cannot infinite-loop or skip a page.
 */
async function findUserByEmail(apiUrl, headers, email) {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; ; page++) {
    const res = await fetch(`${apiUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`Failed to list local users: ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    const users = Array.isArray(body?.users) ? body.users : [];
    const match = users.find(
      (u) => typeof u?.email === "string" && u.email.toLowerCase() === target,
    );
    if (match) return match;
    if (users.length === 0) return null;
  }
}

async function main() {
  const status = getLocalSupabaseStatus();
  const apiUrl = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;

  if (!apiUrl || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiUrl)) {
    throw new Error(
      `Refusing to run: resolved API_URL "${apiUrl}" is not a local address. ` +
        `This script must only ever run against the local Supabase stack.`,
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Could not resolve a SERVICE_ROLE_KEY from `supabase status` — is the local stack running?",
    );
  }

  const envTest = readEnvTest();
  const email = envTest.E2E_TEST_EMAIL;
  const password = envTest.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL/E2E_TEST_PASSWORD missing from .env.test.");
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const existingUser = await findUserByEmail(apiUrl, headers, email);

  if (existingUser) {
    console.log(`Local E2E test user already exists (${email}) — nothing to do.`);
    return;
  }

  const createRes = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Failed to create local E2E test user: ${createRes.status} ${body}`);
  }
  console.log(`Created local E2E test user (${email}).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
