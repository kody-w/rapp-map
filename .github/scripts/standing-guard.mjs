#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { verifyRegistry } from "./registry-verify.mjs";
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
  invariant(Array.isArray(ledger.blockers) && ledger.blockers.length === 1, "one owner blocker is required");
  const blocker = ledger.blockers[0];
  invariant(blocker.id === "rapp1-section-13-authenticated-registry", "section 13 owner blocker id drifted");
  invariant(
    Array.isArray(blocker.acceptance_tests) && blocker.acceptance_tests.length >= 7,
    "owner ledger must retain the decision acceptance tests"
  );
  if (blocker.state === "open") {
    invariant(ledger.status === "blocked-on-owner", "an open blocker means status blocked-on-owner");
    invariant(ledger.authoritative === false && ledger.can_grant_rapp1_acceptance === false, "an open blocker cannot grant");
    invariant(
      blocker.owner_inputs && Object.values(blocker.owner_inputs).every((value) => value === null),
      "unknown owner inputs must remain explicit null values"
    );
    return `owner-blocker=${blocker.id} state=open inputs=null`;
  }
  invariant(blocker.state === "closed", "owner blocker state must be open or closed");
  invariant(ledger.status === "owner-published", "a closed blocker means status owner-published");
  invariant(ledger.authoritative === true && ledger.can_grant_rapp1_acceptance === true, "owner-published ledger is authoritative");
  const inputs = blocker.owner_inputs ?? {};
  for (const field of ["estate_owner_rappid", "estate_owner_spki_der_b64", "registry_seq", "canonical_source", "registry_document_url", "registry_document_sha256", "registry_sig"]) {
    invariant(inputs[field] !== null && inputs[field] !== undefined, `owner input ${field} must be recorded`);
  }
  invariant(typeof blocker.where?.owner_publication_location === "string", "closed blocker must record the publication location");
  invariant(blocker.when?.owner_decision_at && blocker.when?.published_at, "closed blocker must record decision and publication times");
  // The ledger's public halves must be the registry's own.
  const registryBytes = await readFile(join(repositoryRoot, "ecosystem-spec.json"));
  invariant(createHash("sha256").update(registryBytes).digest("hex") === inputs.registry_document_sha256, "ledger registry_document_sha256 != ecosystem-spec.json bytes");
  const registry = JSON.parse(registryBytes.toString("utf8"));
  invariant(registry.sig === inputs.registry_sig && registry.registry_seq === inputs.registry_seq && registry.canonical_source === inputs.canonical_source, "ledger sig/seq/source disagree with the registry");
  const owner = registry.entries.find((entry) => entry.type === "estate_owner")?.rappid;
  const spki = registry.entries.find((entry) => entry.type === "spki" && entry.rappid === owner)?.spki_der_b64;
  invariant(owner === inputs.estate_owner_rappid && spki === inputs.estate_owner_spki_der_b64, "ledger owner/spki disagree with the registry");
  return `owner-blocker=${blocker.id} state=closed published=${blocker.when.published_at}`;
}

async function checkRegistry() {
  const ledger = await json("RAPP1_OWNER_ACTIONS.json");
  const candidate = await json("ecosystem-spec.json");
  if (ledger.blockers[0].state === "open") {
    invariant(candidate.document_type === "registry-path-status", "registry path must contain status only");
    invariant(candidate.disposition === "quarantined-candidate", "registry path must remain quarantined");
    invariant(candidate.accepted_as_rapp1_registry === false, "registry candidate must not be accepted");
    invariant(candidate.authenticated_registry === null, "authenticated_registry must remain null");
    for (const forbidden of ["schema", "registry_seq", "sig", "entries", "estate_owner"]) {
      invariant(!Object.hasOwn(candidate, forbidden), `registry status must not expose accepted-registry field ${forbidden}`);
    }
    return "ecosystem-spec.json refused as authenticated registry";
  }
  // Owner-published: the document must BE the signed registry, and the signature must verify here,
  // with Node built-ins only, against the estate_owner SPKI whose tail is the rappid.
  const result = verifyRegistry(candidate);
  invariant(result.owner === ledger.blockers[0].owner_inputs.estate_owner_rappid, "registry owner != ledger owner");
  return `ecosystem-spec.json verified: owner=${result.owner.slice(0, 40)}… seq=${result.seq} kinds=${result.kinds} rapp/1=${result.rapp1SpecHash.slice(0, 12)}…`;
}

async function checkHistoricalDispositions() {
  const sidecar = await json("HISTORICAL_OBSERVATIONS.json");
  const fileBytes = {
    "neurons.json": await readFile(join(repositoryRoot, "neurons.json")),
    "neurons-manifest.json": await readFile(join(repositoryRoot, "neurons-manifest.json"))
  };
  validateHistoricalObservations(sidecar, fileBytes);
  return `historical observations=${sidecar.observations.length} baseline-bytes=exact disposition=sidecar-only`;
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
  invariant(
    candidate.schema === "rapp/1-registry" || !Object.hasOwn(candidate, "schema"),
    "registry path is either the signed rapp/1-registry or a schema-less quarantine status"
  );
  invariant(
    globalThis[Symbol.for("rapp-map.offline-guard")]?.schema ===
      "rapp-map-offline-guard/1.0",
    "offline guard interface token drifted"
  );
  return `sidecar=1.0 graph=2 identity-vectors=3 offline-guard=1.0 registry=${candidate.schema ?? "quarantine"}`;
}

async function checkLocal() {
  const checks = [
    ["json", checkAllJson],
    ["authority", checkAuthority],
    ["owner-ledger", checkOwnerLedger],
    ["registry", checkRegistry],
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
    "RESULT PASS: structural checks passed; registry state was verified from the ledger and the document, never inferred."
  );
}

async function showBlocker() {
  const ledger = await json("RAPP1_OWNER_ACTIONS.json");
  const candidate = await json("ecosystem-spec.json");
  const blocker = ledger.blockers[0];
  console.log(blocker.state === "open" ? "RAPP/1 owner decision required" : "RAPP/1 owner decision recorded");
  console.log(`status=${ledger.status}`);
  console.log(`blocker=${blocker.id} state=${blocker.state}`);
  console.log(`why=${blocker.why}`);
  console.log(`what=${blocker.what}`);
  console.log(`where=${blocker.where.owner_publication_location ?? blocker.where.required_repository_path}`);
  console.log(`owner-inputs=${blocker.state === "open" ? "null" : "recorded"}`);
  console.log(`acceptance-tests=${blocker.acceptance_tests.length}`);
  console.log(`registry=${candidate.schema ?? String(candidate.authenticated_registry)}`);
  console.log(`registry-seq=${candidate.registry_seq ?? "none"}`);
  console.log("This report is informational; acceptance comes from the verified signature, not from this text.");
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
