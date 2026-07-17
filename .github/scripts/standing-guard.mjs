#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE_COMMIT = "baded0098d8b97c2876c0b8af4475cf3061b7ad0";
const AUTHORITY = {
  document_type: "rapp-1-authority-pin",
  repository: "kody-w/rapp-1",
  commit: "6723c7add2aed36bb68992fc71a56b0a4bd5ad81",
  spec_path: "SPEC.md",
  spec_revision: 5,
  raw_url:
    "https://raw.githubusercontent.com/kody-w/rapp-1/6723c7add2aed36bb68992fc71a56b0a4bd5ad81/SPEC.md",
  bytes: 41880,
  sha256: "6d06daba65d7c045716f3d6e95db8401ab58e727820e4114466d847f62cae49b",
  structural_pin_only: true,
  authenticated_registry_acceptance: false
};
const WORKFLOW_PINS = {
  "actions/checkout": "34e114876b0b11c390a56381ad16ebd13914f8d5",
  "actions/setup-node": "49933ea5288caeca8642d1e84afbd3f7d6820020",
  "kody-w/rapp-drift-lint/.github/workflows/drift-lint-reusable.yml":
    "de1c664154d3456224bdf95e830736ffb5270c2b"
};

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
  const expectations = [
    ["estate-map.json", 92, "2026-06-28T20:21:23Z"],
    ["neurons.json", 630, "2026-06-28T20:03:35Z"],
    ["neurons-manifest.json", 630, "2026-06-28T20:03:35Z"]
  ];
  for (const [path, count, capturedAt] of expectations) {
    const document = await json(path);
    const disposition = document._disposition;
    invariant(
      disposition?.classification?.startsWith("historical-observation"),
      `${path} must be classified as a historical observation`
    );
    invariant(disposition.authoritative === false, `${path} must be non-authoritative`);
    invariant(disposition.rapp1_registry === false, `${path} must not be a RAPP/1 registry`);
    invariant(disposition.captured_at === capturedAt, `${path} capture time drifted`);
    invariant(disposition.source_commit === BASELINE_COMMIT, `${path} source commit drifted`);
    invariant(
      disposition.authority_pin === "RAPP1_AUTHORITY.json",
      `${path} authority pin reference drifted`
    );
    invariant(document.count === count, `${path} historical count changed unexpectedly`);
  }
  return "historical observations=3 non-authoritative=true";
}

async function checkGraph() {
  const graph = await json("graph.json");
  invariant(graph.generation === "deterministic-offline", "graph generation must be deterministic offline");
  invariant(graph.disposition?.authoritative === false, "graph must be non-authoritative");
  invariant(graph.disposition?.rapp1_registry === false, "graph must not be a registry");
  invariant(graph.disposition?.authenticated_registry === null, "graph cannot claim registry evidence");
  invariant(graph.disposition?.owner_acceptance === false, "graph cannot claim owner acceptance");
  invariant(
    graph.protocol_authority?.repository === AUTHORITY.repository &&
      graph.protocol_authority?.commit === AUTHORITY.commit &&
      graph.protocol_authority?.sha256 === AUTHORITY.sha256,
    "graph protocol authority pin drifted"
  );
  invariant(Array.isArray(graph.nodes) && graph.nodes.length === 5, "graph must contain five scoped nodes");
  const authorities = graph.nodes.filter((node) => node.authority === true);
  invariant(
    authorities.length === 1 &&
      authorities[0].id === "rapp-1" &&
      authorities[0].repo === AUTHORITY.repository &&
      authorities[0].pinned_commit === AUTHORITY.commit,
    "rapp-1 must be the sole graph authority"
  );
  const subordinates = graph.nodes.filter((node) => node.id !== "rapp-1");
  invariant(
    subordinates.every((node) => node.authority === false && node.subordinate === true),
    "all map, observation, documentation, and application nodes must be subordinate"
  );
  invariant(
    Array.isArray(graph.edges) &&
      graph.edges.length === subordinates.length &&
      graph.edges.every(
        (edge) => edge.to === "rapp-1" && edge.type === "subordinate_to"
      ),
    "every subordinate graph node must point to rapp-1"
  );
  return "graph authority=1 subordinate-nodes=4";
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
  const workflowPaths = [
    ".github/workflows/drift-lint.yml",
    ".github/workflows/standing-guard.yml"
  ];
  let usesCount = 0;
  for (const path of workflowPaths) {
    const source = await text(path);
    const uses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gmu)].map((match) => match[1]);
    invariant(uses.length > 0, `${path} has no workflow references`);
    for (const reference of uses) {
      usesCount += 1;
      const at = reference.lastIndexOf("@");
      invariant(at > 0, `${path} has an unpinned reference: ${reference}`);
      const action = reference.slice(0, at);
      const pin = reference.slice(at + 1);
      invariant(/^[0-9a-f]{40}$/.test(pin), `${path} reference is mutable: ${reference}`);
      invariant(Object.hasOwn(WORKFLOW_PINS, action), `${path} uses unexpected action ${action}`);
      invariant(pin === WORKFLOW_PINS[action], `${path} uses the wrong pin for ${action}`);
    }
  }
  const drift = await text(".github/workflows/drift-lint.yml");
  invariant(
    drift.includes("permissions: { contents: read }"),
    "drift-lint workflow must retain read-only contents permission"
  );
  const guard = await text(".github/workflows/standing-guard.yml");
  invariant(/^permissions:\s*\{\}\s*$/mu.test(guard), "standing guard must default to no permissions");
  invariant(!/contents:\s*write/u.test(guard), "standing guard must not write repository contents");
  invariant(
    (guard.match(/issues:\s*write/gu) ?? []).length === 1,
    "only the opt-in report job may write issues"
  );
  return `workflow-references=${usesCount} immutable=true`;
}

async function checkOfflineSources() {
  const python = await text("build_graph.py");
  invariant(
    !/\b(?:urllib|requests|httpx|socket)\b|urlopen\s*\(/u.test(python),
    "build_graph.py contains a network dependency"
  );
  const offlineScripts = [
    "conformance/run-conformance.mjs",
    "conformance/waiver-freshness.mjs"
  ];
  for (const path of offlineScripts) {
    const source = await text(path);
    invariant(
      !/\bfetch\s*\(|node:https|node:http/u.test(source),
      `${path} contains a network call in a local check`
    );
  }
  return "local-check-network-calls=0 standing-guard-fetch=runtime-disabled";
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
    ["offline", checkOfflineSources]
  ];

  console.log("RAPP/1 standing guard (offline structural checks)");
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
    Object.defineProperty(globalThis, "fetch", {
      configurable: false,
      value() {
        throw new Error("network access is disabled for standing-guard local commands");
      }
    });
  }
  await commands[command]();
}

main().catch((error) => {
  console.error(`STANDING GUARD ERROR [${process.argv[2] ?? "unknown"}]: ${error.message}`);
  process.exitCode = 1;
});
