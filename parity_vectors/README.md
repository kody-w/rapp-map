# Candidate runtime-parity corpus (offered, not authoritative)

> **Standing.** These vectors were authored in
> [kody-w/openrappter](https://github.com/kody-w/openrappter) and are offered
> here as a *candidate* corpus for the one PARITY §5 specifies and marks
> PLANNED. They are **not an authority**. openrappter is a substrate distro,
> not the reference runtime — the reference is the grail brainstem. Nothing
> here should be read as canonical unless and until the owners of the spec say
> so.
>
> **openrappter declares tier `core` and is self-assessed only.** No party
> outside openrappter has verified that claim. Publishing the vectors is an
> attempt to make it checkable by someone else, not a claim that it has been
> checked.
>
> **Every vector runs without a live model, and the count is reported either
> way.** PARITY §5.2 mandates `model.kind = "scripted"` for the whole corpus, so
> the harness scripts the model *data* while the runtime executes its real loop
> over real HTTP. openrappter's CI therefore executes 13 of 13 `core` vectors
> with no model and no credentials — `voice-sentinel-split` is full-tier and is
> excluded from `core` by the spec's own tagging, not skipped. The harness still
> carries a `not_executed` state and reports its count, so that a vector added
> later which genuinely needs a model is named as unproven rather than dropping
> out of the denominator. Silent skipping is the failure this corpus exists to
> prevent.
>
> **What can be checked in this repository, and is:** `verify_corpus.py`
> confirms the vectors parse, cover the fourteen named classes, and hash to the
> digest `CORPUS.json` declares. It does **not** execute them —
> `parity_harness.py` needs a live `/chat` on loopback, and this repository's
> offline gate denies sockets by design. Executing the corpus is the job of a
> runtime, not of the map.

---

# Golden conformance vectors — `rapp-runtime-parity/1.0`

A candidate implementation of the corpus PARITY §5 specifies and marks
**PLANNED**. Neither the corpus nor `parity_harness.py` is committed anywhere in
the estate: `rapp_brainstem/parity_vectors/` and its `rapp-map` mirror are both
404. openrappter declares parity tier `core` in `SPEC.md`, and until something
executed these vectors that declaration was an assertion about ourselves that
nobody — including us — could check.

## What is here

14 vectors, one per class required by §5.3. Thirteen are `core`;
`voice-sentinel-split` is full-only, matching the spec's own tagging.

| # | Vector | Tier |
|---|--------|------|
| 1 | `empty-input-400` | core |
| 2 | `no-agents-passthrough` | core |
| 3 | `single-tool-then-answer` | core |
| 4 | `parallel-tool-calls` | core |
| 5 | `multi-round-tools` | core |
| 6 | `round-cap-3` | core |
| 7 | `bad-arguments-fallback` | core |
| 8 | `agent-not-found` | core |
| 9 | `agent-raises` | core |
| 10 | `history-role-filter` | core |
| 11 | `system-context-injection` | core |
| 12 | `finish-reason-agnostic-trigger` | core |
| 13 | `session-id-minted` | core |
| 14 | `voice-sentinel-split` | full |

`CORPUS.json` carries the per-vector digests and the corpus digest, so a runtime
can attest *exactly which* corpus it passed (§5).

## Offering this upstream

The vector files contain nothing openrappter-specific — no ports, paths, model
names or runtime details — so they can be moved to
`rapp_brainstem/parity_vectors/` unchanged. The harness (`../parity_harness.py`)
is ours and is not part of the corpus.

## Two things the spec leaves open

Both are decisions this corpus had to make in order to exist. Neither is
authoritative; if upstream rules differently, the vectors change, not the rule.

1. **Canonical JSON is not defined.** §5 says vectors are content-addressed by
   "sha256 of their canonical JSON" without saying what canonical means. This
   corpus uses sorted keys, `(',', ':')` separators and UTF-8 — and hashes the
   *parsed* content, so the digest is stable whether the file on disk is
   pretty-printed or minified. The rule is recorded in `CORPUS.json`.

2. **A minted value cannot be asserted exactly.** §5.3.13 requires
   `session-id-minted` to check for a valid UUIDv4, but §6.1 says comparison is
   exact. Expressing that needs an escape, so this corpus uses
   `{"$match": "uuid4"}`. It is the only construct here that is not literal
   equality.

## Running it

```
python3 parity_harness.py --tier core
python3 parity_harness.py --tier full --report report.json
```

The harness injects a scripted model at the runtime's model-call seam, as §5.2
requires — the runtime runs its real loop over real HTTP and only the model
*data* is scripted.

## Running these vectors against your own runtime

Two different things, deliberately separated.

**1. Verify the corpus is intact.** No runtime, no network, no dependencies —
this is what the offline gate in this repository runs:

```sh
python3 parity_vectors/verify_corpus.py
```

It re-derives the corpus digest from the vector files and compares it with the
one `CORPUS.json` declares, so a tampered or truncated corpus fails rather than
silently checking less than it claims. It does **not** prove any runtime
conforms — only that these are the vectors they say they are.

**2. Execute the vectors against a runtime.** `parity_harness.py` ships beside
them so a third party can actually run them, which is the only thing that turns
a tier declaration into evidence:

```sh
python3 parity_harness.py --vectors parity_vectors --tier core
```

As shipped, the harness imports `openrappter.brainstem` and drives openrappter's
`/chat` over loopback. To point it at a different runtime, replace that import
and the request shape with your own; the vector files themselves are runtime-
neutral and need no change — they contain no ports, paths, model names or
implementation details.

The harness injects a scripted model at the model-call seam, as PARITY §5.2
requires: the runtime executes its real loop over real HTTP, and only the model
*data* is scripted. That is what makes a result comparable across runtimes
rather than a test of one implementation's mocks.

**Report anything you cannot execute as not-executed, never as passed.** As
written every vector is scripted-model and needs no credentials, so a runtime
that cannot execute one should say which and why. Counting an unexecuted vector
as a pass would make the corpus assert exactly what it was built to check.
