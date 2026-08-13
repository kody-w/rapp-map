#!/usr/bin/env python3
"""Verify the candidate runtime-parity corpus is internally consistent.

This checks the corpus, not any runtime. rapp-map holds no runtime to execute
vectors against, and the offline guard denies sockets, so the executing harness
(parity_harness.py, alongside) cannot run here — it needs a live `/chat` on
loopback. What can be checked here, and is:

  * every vector parses and carries the fields the spec names;
  * every vector declares one of the fourteen classes in PARITY 5.2;
  * the recomputed corpus digest equals the one CORPUS.json declares, using the
    canonicalization CORPUS.json itself states;
  * the vector count matches;
  * no vector claims to have passed anything — these are inputs and expected
    outputs, not results.

Dependency-free, stdlib only, no network, no subprocess. Mirrors the
conventions of conformance/run-conformance.mjs.

    python3 parity_vectors/verify_corpus.py
"""

import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# PARITY 5.2. Named here so a vector cannot quietly invent a fifteenth class,
# and so a reader can see the coverage claim without leaving the file.
CLASSES = {
    "no-agents-passthrough", "single-tool-then-answer", "multi-round-tools",
    "round-cap-3", "parallel-tool-calls", "agent-raises", "agent-not-found",
    "bad-arguments-fallback", "empty-input-400", "session-id-minted",
    "history-role-filter", "system-context-injection", "voice-sentinel-split",
    "finish-reason-agnostic-trigger",
}

REQUIRED = ("id", "name", "spec", "tags", "request", "expect")
SPEC = "rapp-runtime-parity/1.0"


def canonical(vector):
    return json.dumps(vector, sort_keys=True, separators=(",", ":")).encode("utf-8")


def main():
    failures = []
    vectors = []

    for path in sorted(HERE.glob("*.json")):
        if path.name == "CORPUS.json":
            continue
        try:
            vector = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            failures.append(f"{path.name}: not valid JSON ({exc})")
            continue
        vectors.append(vector)
        # The file name is how a reader finds a class; a mismatch makes the
        # corpus hard to navigate and easy to mis-cite.
        if vector.get("name") != path.stem:
            failures.append(f"{path.name}: name {vector.get('name')!r} does not match the file name")

    if not vectors:
        print("FAIL: no vectors found", file=sys.stderr)
        return 1

    for vector in vectors:
        name = vector.get("name", "(unnamed)")
        for field in REQUIRED:
            if field not in vector:
                failures.append(f"{name}: missing required field {field!r}")
        if vector.get("spec") != SPEC:
            failures.append(f"{name}: spec is {vector.get('spec')!r}, expected {SPEC!r}")
        if name not in CLASSES:
            failures.append(f"{name}: not one of the fourteen classes named in PARITY 5.2")
        tags = vector.get("tags")
        if not isinstance(tags, dict) or "core" not in tags:
            failures.append(f"{name}: tags must carry a tier, e.g. {{'core': true}}")
        # A vector is a question and its expected answer. A vector carrying a
        # result would let a corpus assert its own conformance.
        for forbidden in ("passed", "status", "result"):
            if forbidden in vector:
                failures.append(f"{name}: carries {forbidden!r} — a vector states expectations, not outcomes")

    manifest_path = HERE / "CORPUS.json"
    if not manifest_path.is_file():
        failures.append("CORPUS.json is missing")
    else:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        lines = "\n".join(sorted(
            f"{v['name']} {hashlib.sha256(canonical(v)).hexdigest()}"
            for v in vectors if "name" in v
        ))
        digest = hashlib.sha256(lines.encode("utf-8")).hexdigest()
        declared = manifest.get("corpus_sha256")
        if digest != declared:
            failures.append(
                f"corpus digest mismatch: recomputed {digest}, CORPUS.json declares {declared}")
        if manifest.get("vector_count") != len(vectors):
            failures.append(
                f"vector_count is {manifest.get('vector_count')} but {len(vectors)} vectors are present")

    covered = {v.get("name") for v in vectors}
    missing = CLASSES - covered

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1

    print(f"PASS candidate parity corpus: {len(vectors)} vectors, "
          f"{len(covered & CLASSES)}/{len(CLASSES)} of the PARITY 5.2 classes")
    print(f"PASS corpus digest {digest[:16]}… matches CORPUS.json")
    if missing:
        # Stated, never silent. An incomplete corpus that reports clean is the
        # failure this corpus exists to prevent.
        print(f"NOTE {len(missing)} class(es) not yet covered: {', '.join(sorted(missing))}")
    print("NOTE these vectors are a candidate offering, not an authority; "
          "executing them requires a live runtime and is out of scope here")
    return 0


if __name__ == "__main__":
    sys.exit(main())
