#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_VECTORS,
  evaluate,
  validateDocument
} from "./identity-validation.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const casesPath = join(directory, "golden-cases.json");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireOfflineGuard() {
  const marker = globalThis[Symbol.for("rapp-map.offline-guard")];
  // Matches the guard check in tests/run-regressions.mjs and
  // tests/offline-guard-probe.mjs — this previously checked only `.schema`,
  // so a marker object with the right schema but `active: false` (or no
  // `active` field at all) passed here even though the guard itself
  // documents `active` as part of what makes it live.
  invariant(
    marker?.schema === "rapp-map-offline-guard/1.0" && marker.active === true,
    "run with NODE_OPTIONS=--import=./.github/scripts/offline-guard.mjs"
  );
}

async function loadDocument() {
  const text = await readFile(casesPath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`golden-cases.json is not valid JSON: ${error.message}`);
  }
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  invariant(nodeMajor >= 20, `Node >=20 is required; found ${process.versions.node}`);
  requireOfflineGuard();

  const document = await loadDocument();
  validateDocument(document);
  let failures = 0;

  console.log("RAPP/1 rev-5 identity conformance");
  console.log(
    `cases=${document.cases.length} bindings=immutable scope=structural-only owner-acceptance=not-evaluated`
  );
  console.log();

  for (const testCase of document.cases) {
    const binding = REQUIRED_VECTORS[testCase.id];
    const outcome = evaluate(testCase);
    const passed =
      outcome.verdict === binding.verdict && outcome.invariant === binding.invariant;
    failures += passed ? 0 : 1;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${testCase.id} expected=${binding.verdict}/${binding.invariant} actual=${outcome.verdict}/${outcome.invariant}`
    );
    console.log(`  ${outcome.detail}`);
  }

  console.log();
  if (failures > 0) {
    console.error(`RESULT FAIL: ${failures}/${document.cases.length} vector(s) disagreed.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `RESULT PASS: ${document.cases.length}/${document.cases.length} bound structural vectors matched; no owner or registry acceptance was inferred.`
  );
}

main().catch((error) => {
  console.error(`CONFORMANCE ERROR: ${error.message}`);
  process.exitCode = 1;
});
