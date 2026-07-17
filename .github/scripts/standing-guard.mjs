#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTHORITY,
  BASELINE_COMMIT,
  validateGraphDocument,
  validateHistoricalObservations,
  validateWorkflowSources
} from "./repository-validators.mjs";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function text(path) {
  return readFile(join(repositoryRoot, path), "utf8");
}

async function json(path) {
  const source = await text(path);
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

async function walkFiles(directory = repositoryRoot) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await walkFiles(path)));
    } else if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}

async function checkAllJson() {
  const files = (await walkFiles())
    .filter((path) => path.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  invariant(files.length > 0, "no JSON files found");
  for (const path of files) {
    const name = relative(repositoryRoot, path);
    try {
      JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      throw new Error(`${name} is not valid JSON: ${error.message}`);
    }
  }
  return `${files.length} JSON files parse`;
}

async function checkAuthority() {
  const authority = await json("RAPP1_AUTHORITY.json");
  for (const [field, expected] of Object.entries(AUTHORITY)) {
    invariant(
      authority[field] === expected,
      `RAPP1_AUTHORITY.json.${field} must be ${JSON.stringify(expected)}`
    );
  }
  invariant(
    authority.authority_scope === "Sole RAPP/1 protocol authority for this repository.",
    "RAPP1_AUTHORITY.json authority_scope drifted"
  );

  const status = await text("RAPP1_STATUS.md");
  invariant(
    status.startsWith("# NOT YET FULLY RAPP/1 CONFORMANT\n"),
    "RAPP1_STATUS.md must lead with the unresolved conformance status"
  );
  return `authority=${authority.repository}@${authority.commit} sha256=${authority.sha256}`;
}

async function checkOwnerLedger() {
  const ledger = await json("RAPP1_OWNER_ACTIONS.json");
  invariant(ledger.status === "blocked-on-owner", "owner ledger must remain blocked-on-owner");
  invariant(ledger.authoritative === false, "owner ledger must be non-authoritative");
  invariant(ledger.can_grant_rapp1_acceptance === false, "owner ledger cannot grant acceptance");
  invariant(Array.isArray(ledger.blockers) && ledger.blockers.length === 1, "one owner blocker is required");

  const blocker = ledger.blockers[0];
  invariant(
    blocker.id === "rapp1-section-13-authenticated-registry" && blocker.state === "open",
    "section 13 owner blocker must remain open"
  );
  invariant(
    blocker.where?.owner_publication_location === null,
    "unknown owner publication location must remain null"
  );
  invariant(
    blocker.when?.owner_decision_at === null && blocker.when?.published_at === null,
    "unknown owner dates must remain null"
  );
  invariant(
    blocker.owner_inputs &&
      Object.keys(blocker.owner_inputs).length > 0 &&
      Object.values(blocker.owner_inputs).every((value) => value === null),
    "unknown owner inputs must remain explicit null values"
  );
  invariant(
    Array.isArray(blocker.acceptance_tests) && blocker.acceptance_tests.length >= 7,
    "owner ledger must retain the decision acceptance tests"
  );
  return `owner-blocker=${blocker.id} inputs=null acceptance-tests=${blocker.acceptance_tests.length}`;
}

async function checkRegistryQuarantine() {
  const candidate = await json("ecosystem-spec.json");
  invariant(candidate.document_type === "registry-path-status", "registry path must contain status only");
  invariant(candidate.disposition === "quarantined-candidate", "registry path must remain quarantined");
  invariant(candidate.accepted_as_rapp1_registry === false, "registry candidate must not be accepted");
  invariant(candidate.authenticated_registry === null, "authenticated_registry must remain null");
  invariant(
    candidate.consumer_requirement?.startsWith("REFUSE "),
    "registry candidate must require fail-closed refusal"
  );
  for (const forbidden of ["schema", "registry_seq", "sig", "entries", "estate_owner"]) {
    invariant(
      !Object.hasOwn(candidate, forbidden),
      `registry status must not expose accepted-registry field ${forbidden}`
    );
  }
  invariant(
    candidate.authority?.commit === AUTHORITY.commit &&
      candidate.authority?.sha256 === AUTHORITY.sha256,
    "registry status authority pin drifted"
  );
  invariant(
    candidate.legacy_snapshot?.availability === "git-history-only" &&
      candidate.legacy_snapshot?.commit === BASELINE_COMMIT &&
      candidate.legacy_snapshot?.authoritative === false,
    "legacy registry snapshot must remain history-only and non-authoritative"
  );
  return "ecosystem-spec.json refused as authenticated registry";
}

async function checkHistoricalDispositions() {
  const sidecar = await json("HISTORICAL_OBSERVATIONS.json");
  const fileBytes = {
    "estate-map.json": await readFile(join(repositoryRoot, "estate-map.json")),
    "neurons.json": await readFile(join(repositoryRoot, "neurons.json")),
    "neurons-manifest.json": await readFile(join(repositoryRoot, "neurons-manifest.json"))
  };
  validateHistoricalObservations(sidecar, fileBytes);
  return "historical observations=3 baseline-bytes=exact disposition=sidecar-only";
}

async function checkGraph() {
  const graph = await json("graph.json");
  validateGraphDocument(graph);
  return "graph-format=2 technical-target=rapp-1 federal-source=RAPP";
}

async function checkWaivers() {
  const waivers = await json("conformance/waivers.json");
  invariant(waivers.disposition?.authoritative === false, "waiver ledger must be non-authoritative");
  invariant(
    waivers.disposition?.can_suppress_rapp1_failures === false,
    "waivers must not suppress RAPP/1 failures"
  );
  invariant(Array.isArray(waivers.waivers) && waivers.waivers.length === 0, "live waivers are prohibited");
  return "waivers=0 suppression=false";
}

async function checkCurrentDocumentation() {
  const tombstones = {
    "ECOSYSTEM_SPEC.md": "# Historical ecosystem specification — retired\n",
    "ECOSYSTEM.md": "# Historical ecosystem release notes\n",
    "ESTATE_MAP.md": "# Historical estate observation\n",
    "NEURON_SWARM.md": "# Historical neuron observation\n",
    "SWARM.md": "# Historical swarm description\n",
    "VISION.md": "# Historical vision document\n"
  };
  const forbiddenTeaching = [
    /rappid:v[0-9]/iu,
    /rapp-twin-chat/iu,
    /brainstem-egg/iu,
    /curl[^\n|]*\|[^\n]*(?:ba)?sh/iu,
    /\b(?:install|hatch|deploy)\s+@rapp\//iu,
    /sha256\s*\(\s*(?:owner|slug|spki|uuid)/iu
  ];
  for (const [path, heading] of Object.entries(tombstones)) {
    const source = await text(path);
    invariant(source.startsWith(heading), `${path} must remain an explicit historical tombstone`);
    invariant(source.includes(BASELINE_COMMIT), `${path} must retain its historical source commit`);
    invariant(Buffer.byteLength(source, "utf8") < 3000, `${path} is too large for a status tombstone`);
    for (const pattern of forbiddenTeaching) {
      invariant(!pattern.test(source), `${path} contains retired live protocol instruction: ${pattern}`);
    }
  }
  const readme = await text("README.md");
  invariant(readme.includes("not yet fully RAPP/1 conformant"), "README must state the owner blocker");
  invariant(readme.includes("read-only repository map"), "README must retain the read-only role");
  return "current docs=tombstones/status retired instructions=absent";
}

async function checkWorkflowPins() {
  const sources = {
    ".github/workflows/drift-lint.yml": await text(".github/workflows/drift-lint.yml"),
    ".github/workflows/standing-guard.yml": await text(".github/workflows/standing-guard.yml")
  };
  const usesCount = validateWorkflowSources(sources);
  return `workflow-references=${usesCount} immutable=true`;
}

async function checkOfflineSources() {
  const python = await text("build_graph.py");
  invariant(
    !/\b(?:urllib|requests|httpx|socket)\b|urlopen\s*\(/u.test(python),
    "build_graph.py contains a network dependency"
  );
  const gateRunner = await text(".github/scripts/run-offline-gates.sh");
  invariant(gateRunner.includes("env -i"), "local gate runner must clear inherited credentials");
  invariant(
    gateRunner.includes("NODE_OPTIONS=\"--import=$GUARD\""),
    "local gate runner must preload the checked-in guard"
  );
  invariant(
    gateRunner.includes("tests/offline-guard-probe.mjs") &&
      gateRunner.includes("tests/run-regressions.mjs"),
    "local gate runner must execute offline and adversarial probes"
  );
  const marker = globalThis[Symbol.for("rapp-map.offline-guard")];
  invariant(
    marker?.schema === "rapp-map-offline-guard/1.0" && marker.active === true,
    "checked-in offline guard is not active"
  );
  invariant(marker.host_enforcement === false, "project guard must not claim host enforcement");
  return "python=network-free-construction node=guarded-project-process host-enforcement=false";
}

async function checkSchemaTokens() {
  const sidecar = await json("HISTORICAL_OBSERVATIONS.json");
  const graph = await json("graph.json");
  const cases = await json("conformance/golden-cases.json");
  const candidate = await json("ecosystem-spec.json");
  invariant(
    sidecar.schema === "rapp-map-historical-observations/1.0",
    "historical sidecar version token drifted"
  );
  invariant(graph.format_version === 2, "graph shape requires format_version 2");
  invariant(cases.format_version === 3, "identity fixture shape requires format_version 3");
  invariant(!Object.hasOwn(candidate, "schema"), "quarantined registry path must remain schema-less");
  invariant(
    globalThis[Symbol.for("rapp-map.offline-guard")]?.schema ===
      "rapp-map-offline-guard/1.0",
    "offline guard interface token drifted"
  );
  return "sidecar=1.0 graph=2 identity-vectors=3 offline-guard=1.0 quarantine=schema-less";
}

async function checkLocal() {
  const checks = [
    ["json", checkAllJson],
    ["authority", checkAuthority],
    ["owner-ledger", checkOwnerLedger],
    ["registry-quarantine", checkRegistryQuarantine],
    ["historical-dispositions", checkHistoricalDispositions],
    ["graph", checkGraph],
    ["waivers", checkWaivers],
    ["documentation", checkCurrentDocumentation],
    ["workflow-pins", checkWorkflowPins],
    ["schema-tokens", checkSchemaTokens],
    ["offline", checkOfflineSources]
  ];

  console.log("RAPP/1 standing guard (guarded local structural checks)");
  for (const [name, check] of checks) {
    const detail = await check();
    console.log(`PASS ${name}: ${detail}`);
  }
  console.log(
    "RESULT PASS: structural checks passed; authenticated registry remains absent and owner acceptance was not inferred."
  );
}

async function showBlocker() {
  const ledger = await json("RAPP1_OWNER_ACTIONS.json");
  const candidate = await json("ecosystem-spec.json");
  const blocker = ledger.blockers[0];

  console.log("RAPP/1 owner decision required");
  console.log(`status=${ledger.status}`);
  console.log(`blocker=${blocker.id}`);
  console.log(`why=${blocker.why}`);
  console.log(`what=${blocker.what}`);
  console.log(`where=${blocker.where.required_repository_path}`);
  console.log("owner-inputs=null");
  console.log(`acceptance-tests=${blocker.acceptance_tests.length}`);
  console.log(`authenticated-registry=${String(candidate.authenticated_registry)}`);
  console.log("fully-conformant=false");
  console.log("This report is informational and does not turn structural success into acceptance.");
}

async function reportBlocker() {
  const { reportOwnerBlocker } = await import("./report-owner-blocker.mjs");
  await reportOwnerBlocker();
}

const commands = {
  local: checkLocal,
  blocker: showBlocker,
  report: reportBlocker
};

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  invariant(nodeMajor >= 20, `Node >=20 is required; found ${process.versions.node}`);
  const command = process.argv[2];
  invariant(
    Object.hasOwn(commands, command),
    `usage: node .github/scripts/standing-guard.mjs <${Object.keys(commands).join("|")}>`
  );
  if (command !== "report") {
    invariant(
      globalThis[Symbol.for("rapp-map.offline-guard")]?.schema ===
        "rapp-map-offline-guard/1.0",
      "run local commands with NODE_OPTIONS=--import=./.github/scripts/offline-guard.mjs"
    );
  }
  await commands[command]();
}

main().catch((error) => {
  console.error(`STANDING GUARD ERROR [${process.argv[2] ?? "unknown"}]: ${error.message}`);
  process.exitCode = 1;
});
