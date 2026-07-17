#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NODE_BIN="$(command -v node)"
if command -v python3.11 >/dev/null 2>&1; then
  PYTHON_BIN="${PYTHON_BIN:-$(command -v python3.11)}"
else
  PYTHON_BIN="${PYTHON_BIN:-$(command -v python3)}"
fi
GUARD="$ROOT/.github/scripts/offline-guard.mjs"
OFFLINE_HOME="$ROOT/.offline-home"
BASELINE="baded0098d8b97c2876c0b8af4475cf3061b7ad0"

guarded_node() {
  env -i \
    PATH="$PATH" \
    HOME="$OFFLINE_HOME" \
    LANG=C \
    CI=true \
    NO_COLOR=1 \
    NODE_OPTIONS="--import=$GUARD" \
    "$NODE_BIN" "$@"
}

clean_python() {
  env -i \
    PATH="$PATH" \
    HOME="$OFFLINE_HOME" \
    LANG=C \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONNOUSERSITE=1 \
    "$PYTHON_BIN" -I "$@"
}

cd "$ROOT"
for evidence in estate-map.json neurons.json neurons-manifest.json; do
  current_blob="$(git hash-object "$evidence")"
  baseline_blob="$(git rev-parse "$BASELINE:$evidence")"
  if [[ "$current_blob" != "$baseline_blob" ]]; then
    echo "Historical evidence differs from baseline: $evidence" >&2
    exit 1
  fi
done
echo "PASS historical evidence: all three Git blob IDs match baseline"

guarded_node conformance/run-conformance.mjs
guarded_node conformance/waiver-freshness.mjs
guarded_node tests/run-regressions.mjs
guarded_node tests/offline-guard-probe.mjs
clean_python build_graph.py --check
guarded_node .github/scripts/standing-guard.mjs local
guarded_node .github/scripts/standing-guard.mjs blocker

echo "RESULT PASS: Node and Python gates ran in credential-empty child environments."
echo "Baseline Git blob checks used local repository objects only."
echo "Boundary: checked-in project-process guard; not host sandbox enforcement."
