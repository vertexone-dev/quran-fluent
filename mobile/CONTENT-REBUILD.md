# Reproducible Quran content rebuild (QR-DESIGN-007D)

`mobile/scripts/rebuild-content-core.mjs` rebuilds, **from files committed to this repository and nothing else**, the content that the approved database's content fingerprint covers, and fails unless the recomputed fingerprint equals the pinned one (`content-db.expected.json`).

```
node mobile/scripts/rebuild-content-core.mjs --out "$(mktemp -d)"
```

## What it rebuilds

| Fingerprinted content                                           | Rebuilt from                                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Arabic text, 58 bootstrap ayahs                                 | `supabase/migrations/20260818042151_*`                                                                    |
| Arabic text, Tanzil Uthmani 1.1, 6,178 ayahs                    | `supabase/migrations/20260820160000_*`                                                                    |
| Pickthall English, 6,236 rows                                   | `supabase/migrations/20260820180000_*`                                                                    |
| Kazimirski French segments (id and text hash) and ayah mappings | `scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json`, ids by the import's `uuid5` formula |

Every input is pinned by SHA-256 in `content-sources.lock.json`. The raw Wikisource page (`texte_entier_raw.html`) must match the manifest's `source_artifact_sha256`, every segment's text must match its recorded hash, and the manifest's own aggregate hash must match its texts.

## Result on the approved content

Fingerprint `b586ba395b9508f1918175bc1c37e0c113ed5c6505a0aa6fec4286469d1225b1`, equal to the approved database's; 114 surahs, 6,236 ayahs, 6,236 Pickthall rows, 6,239 Kazimirski segments, 6,396 mappings. A row-by-row comparison with the approved database (a temporary copy) found zero differing rows in every table, including the surah names the fingerprint does not cover.

## What it proves, and what it does not

- **Proves:** the Quran content in the approved database is exactly the content committed in the repository's migrations and Kazimirski manifest, and that content cannot change without the pinned hashes or the pinned fingerprint changing.
- **Does not prove authenticity.** It does not re-fetch Tanzil, Gutenberg or Wikisource (it uses no network), so it does not show the committed text equals the original sources. That is the source-verification workflow's job (`mobile/docs/SOURCE-VERIFICATION-WORKFLOW.md`).
- **Does not rebuild** the curriculum tables (courses, levels, lessons, exercises, vocabulary), `content_sources` or the per-locale translation overrides. They are outside the fingerprint; their ids come from the production database. The full Playwright suite needs them, so the `content` job and the release gate still require the full approved database (see `CI-DATABASE-STRATEGY.md`).

## Safety

No database, network, secret or production access; writes only inside `--out`; refuses an `--out` inside the repository or at `quran-content.sqlite` / `content-db`; never opens the approved database. Fails (non-zero) on: a changed pinned input, a count mismatch, a text-hash mismatch, a missing ayah, or a fingerprint mismatch. The CI job `content-integrity` runs it on every pull request (including forks, which receive no secrets) and the release gate requires it.

## Changing the inputs

Changing a pinned input, `content-sources.lock.json` or `content-db.expected.json` is a content change: it needs owner approval and a source-verification review. Do not update the pins to make a failing check pass.
