#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const waiversPath = join(directory, "waivers.json");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  invariant(nodeMajor >= 20, `Node >=20 is required; found ${process.versions.node}`);
  invariant(
    globalThis[Symbol.for("rapp-map.offline-guard")]?.schema ===
      "rapp-map-offline-guard/1.0",
    "run with NODE_OPTIONS=--import=./.github/scripts/offline-guard.mjs"
  );

  const text = await readFile(waiversPath, "utf8");
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`waivers.json is not valid JSON: ${error.message}`);
  }

  invariant(
    document?.document_type === "rapp-1-waiver-ledger-status",
    "waivers.json document_type is invalid"
  );
  invariant(document.disposition?.classification === "retired", "waiver ledger must be retired");
  invariant(document.disposition?.authoritative === false, "waiver ledger must be non-authoritative");
  invariant(
    document.disposition?.can_suppress_rapp1_failures === false,
    "waiver ledger must not suppress RAPP/1 failures"
  );
  invariant(
    document.disposition?.network_refresh === false,
    "waiver validation must remain offline"
  );
  invariant(Array.isArray(document.waivers), "waivers.json.waivers must be an array");
  invariant(document.waivers.length === 0, "live RAPP/1 waivers are prohibited");

  console.log("RAPP/1 waiver retirement");
  console.log(
    "waivers=0 authoritative=false suppression=false network=guarded-project-process host-enforcement=false"
  );
  console.log("RESULT PASS: no live waiver can hide a RAPP/1 failure.");
}

main().catch((error) => {
  console.error(`WAIVER RETIREMENT ERROR: ${error.message}`);
  process.exitCode = 1;
});
