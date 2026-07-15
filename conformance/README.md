# Golden drift conformance

This directory is the executable baseline for RAPP drift rulings. Its fixtures are synthetic and contain no customer data. The suite tests eight known drift classes and preserves three corroborated historical findings with `resolved: "pending"` until their live status is established.

## Run

Use Node 20 or newer. There are no package or runtime dependencies.

```sh
node conformance/run-conformance.mjs
node conformance/waiver-freshness.mjs
```

The runner loads `golden-cases.json` and `waivers.json`, executes the class checker for every mechanical fixture, and compares the result with `expected_verdict`. It exits non-zero for malformed input or any mechanical mismatch. A judgment fixture prints `JUDGE-REQUIRED` and the exact question; judgment items do not change the mechanical exit code.

The waiver-freshness guard validates the waiver ledger, fetches every active waiver's pinned canon URL, and requires both the exact passage and its SHA-256 to remain unchanged. Expired waivers are reported and skipped. A moved or edited canon passage makes the waiver stale and reopens its finding.

`DRIFT` in a golden fixture is expected test data. It proves the checker detects that class; it is not a live unexplained finding. `CLEAN` proves the checker recognizes a conforming or explicitly governed condition. `WAIVED` requires an active exact-id entry in `waivers.json`.

## Validate, then trust

1. Run this reference runner. Do not trust a sweep if any mechanical golden case fails.
2. Run the future model or script over the same fixtures and compare every verdict with `expected_verdict`.
3. For each `JUDGE-REQUIRED` case, have the reviewer answer the printed question and apply `expected_ruling`. A model's judgment is not validated merely because the mechanical runner exits zero.
4. Only after those results agree should the sweep inspect live ecosystem data.
5. Apply the live gate: zero unexplained drift. Every live finding must be fixed or covered by an active waiver whose `case_or_finding` exactly matches the finding id.

An expired waiver is inactive. The ledger started empty; entries are dated adjudications.

## Mechanical fixture contracts

| Class | Check |
| --- | --- |
| `catalog-outran-reality` | Every catalog item marked `active`, `live`, or `shipped` has a successful entry in `resolutions`. |
| `mirror-divergence` | SHA-256 of the two inline texts is equal. |
| `schema-version-lag` | The consumer names the same contract, accepts the emitted version, and exposes a superset of the producer's required enum. |
| `rappid-invariant-violation` | The 64-hex identifier equals SHA-256 of `master_pubkey_SPKI`, or SHA-256 of a normalized stable UUID. `sha256(owner/slug)` is always illegal. |
| `bible-pin-stale` | Bible and ecosystem-spec versions are equal. |
| `kernel-pin-lag` | Distribution bytes equal the grail, or an `intentional-lts` pin matches the distributed version and digest and its freeze check passes. |
| `name-collision-unnamed` | Trimmed, case-folded names are unique; blank and placeholder names normalize to `__unnamed__`. |
| `private-name-leak` | An escaped, boundary-aware regular expression finds no private identifier in public text. |

## Add a case

Add one object to `golden-cases.json` with a unique `id`, a registered `class`, a minimal inline `fixture`, `expected_verdict`, and an `expected_ruling` containing both `citation` and `rationale`. Use only synthetic names and content. Do not add a schema id for the fixture. For a historical finding, also set `historical: true`, its source, and `resolved: "pending"`.

Use `fixture.mode: "judgment"` only when the ruling cannot be reduced to a deterministic check, and include one precise `review_question`. For a new drift class, add its checker and class name to `run-conformance.mjs`. Run the suite before accepting the case.

Waivers have the shape documented by the `$comment` in `waivers.json`: `id`, `case_or_finding`, `why_intentional`, `approved_by`, `date`, optional `expires`, `canon_url`, `passage`, and `passage_sha256`, with dates in `YYYY-MM-DD` and SHA-256 pins as 64 lowercase hex characters.
