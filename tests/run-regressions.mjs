#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateGraphDocument,
  validateHistoricalObservations,
  validateWorkflowSources
} from "../.github/scripts/repository-validators.mjs";
import {
  ISSUE_MARKER,
  DEFAULT_TITLE,
  reportOwnerBlocker
} from "../.github/scripts/report-owner-blocker.mjs";
import {
  REQUIRED_VECTORS,
  evaluate,
  validateDocument
} from "../conformance/identity-validation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guard = globalThis[Symbol.for("rapp-map.offline-guard")];
if (guard?.schema !== "rapp-map-offline-guard/1.0" || guard.active !== true) {
  throw new Error("run regression tests with the checked-in offline guard preload");
}

let checks = 0;
function pass(name) {
  checks += 1;
  console.log(`PASS ${name}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectThrows(name, operation, pattern) {
  try {
    operation();
  } catch (error) {
    assert(pattern.test(String(error?.message)), `${name} threw the wrong error: ${error?.message}`);
    pass(name);
    return;
  }
  throw new Error(`${name} did not fail`);
}

async function expectRejects(name, operation, pattern) {
  try {
    await operation();
  } catch (error) {
    assert(pattern.test(String(error?.message)), `${name} rejected incorrectly: ${error?.message}`);
    pass(name);
    return;
  }
  throw new Error(`${name} did not reject`);
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

const sidecar = await loadJson("HISTORICAL_OBSERVATIONS.json");
const evidenceBytes = {
  "estate-map.json": await readFile(join(root, "estate-map.json")),
  "neurons.json": await readFile(join(root, "neurons.json")),
  "neurons-manifest.json": await readFile(join(root, "neurons-manifest.json"))
};
validateHistoricalObservations(sidecar, evidenceBytes);
pass("baseline historical evidence and sidecar validate");

const changedEvidence = { ...evidenceBytes, "estate-map.json": Buffer.from(evidenceBytes["estate-map.json"]) };
changedEvidence["estate-map.json"][0] ^= 0x01;
expectThrows(
  "one-byte historical evidence mutation is refused",
  () => validateHistoricalObservations(sidecar, changedEvidence),
  /baseline SHA-256/u
);

const changedSidecar = structuredClone(sidecar);
changedSidecar.observations[0].sha256 = "0".repeat(64);
expectThrows(
  "historical sidecar digest mutation is refused",
  () => validateHistoricalObservations(changedSidecar, evidenceBytes),
  /sidecar sha256 drifted/u
);

const graph = await loadJson("graph.json");
validateGraphDocument(graph);
pass("graph format 2 validates");

const removedGraphEdge = structuredClone(graph);
removedGraphEdge.edges = removedGraphEdge.edges.filter(
  (edge) =>
    !(
      edge.from === "rapp-map" &&
      edge.to === "rapp-1" &&
      edge.type === "conforms_to"
    )
);
expectThrows(
  "graph technical authority edge removal is refused",
  () => validateGraphDocument(removedGraphEdge),
  /edge set/u
);

const mutatedGraphEdge = structuredClone(graph);
mutatedGraphEdge.edges.find((edge) => edge.type === "subordinate_to").to = "rapp-1";
expectThrows(
  "graph subordination target mutation is refused",
  () => validateGraphDocument(mutatedGraphEdge),
  /missing required edge|subordinate_to/u
);

const staleGraphToken = structuredClone(graph);
staleGraphToken.format_version = 1;
expectThrows(
  "changed graph shape with stale token is refused",
  () => validateGraphDocument(staleGraphToken),
  /format_version/u
);

const workflowSources = {
  ".github/workflows/drift-lint.yml": await readFile(
    join(root, ".github/workflows/drift-lint.yml"),
    "utf8"
  ),
  ".github/workflows/standing-guard.yml": await readFile(
    join(root, ".github/workflows/standing-guard.yml"),
    "utf8"
  )
};
validateWorkflowSources(workflowSources);
pass("workflows use only direct immutable actions");

const nestedWorkflow = {
  ...workflowSources,
  ".github/workflows/drift-lint.yml": workflowSources[".github/workflows/drift-lint.yml"].replace(
    /uses: actions\/checkout@[0-9a-f]{40}/u,
    "uses: example/external/.github/workflows/reusable.yml@0123456789abcdef0123456789abcdef01234567"
  )
};
expectThrows(
  "nested external workflow is refused even when its outer ref is immutable",
  () => validateWorkflowSources(nestedWorkflow),
  /external or nested workflow/u
);

const mutableAction = {
  ...workflowSources,
  ".github/workflows/drift-lint.yml": workflowSources[".github/workflows/drift-lint.yml"].replace(
    /uses: actions\/checkout@[0-9a-f]{40}/u,
    "uses: actions/checkout@main"
  )
};
expectThrows(
  "mutable direct action ref is refused",
  () => validateWorkflowSources(mutableAction),
  /wrong immutable pin/u
);

const cases = await loadJson("conformance/golden-cases.json");
validateDocument(cases);
pass("required identity vectors match independent bindings");

const changedFixture = structuredClone(cases);
changedFixture.cases[0].rappid = changedFixture.cases[0].rappid.replace(/.$/u, "0");
expectThrows(
  "required fixture mutation is refused",
  () => validateDocument(changedFixture),
  /immutable digest/u
);

const changedVerdict = structuredClone(cases);
changedVerdict.cases[0].expected_verdict = "DRIFT";
expectThrows(
  "required verdict mutation is refused",
  () => validateDocument(changedVerdict),
  /independently pinned verdict/u
);

const caseById = new Map(cases.cases.map((testCase) => [testCase.id, testCase]));
for (const id of [
  "rev5-keyed-spki-der",
  "rev5-forbid-spki-trailing-one-byte",
  "rev5-forbid-spki-trailing-four-bytes",
  "rev5-forbid-spki-malformed-length"
]) {
  const outcome = evaluate(caseById.get(id));
  const binding = REQUIRED_VECTORS[id];
  assert(
    outcome.verdict === binding.verdict && outcome.invariant === binding.invariant,
    `${id} did not prove its exact DER invariant`
  );
}
pass("exact SPKI DER and trailing/malformed vectors are enforced");

function mockRequest(openIssues) {
  const calls = [];
  const request = async (_token, path, options = {}) => {
    calls.push({ path, options });
    if (path.includes("?state=all")) {
      return openIssues;
    }
    if (options.method === "PATCH") {
      return { number: Number(path.split("/").at(-1)) };
    }
    if (options.method === "POST") {
      return { number: 9001 };
    }
    throw new Error(`unexpected mock request: ${path}`);
  };
  return { request, calls };
}

const environment = {
  RAPP1_REPORT_OWNER_BLOCKER: "true",
  GITHUB_TOKEN: "synthetic-test-token",
  GITHUB_REPOSITORY: "kody-w/rapp-map"
};
assert(
  ISSUE_MARKER ===
    "<!-- rapp1-owner-blocker:3c5b3c0c5eb3512bc037954a8c0ceb1d7c1ecd4b82641ef303ec9cf483b0d82e -->",
  "managed issue fingerprint changed"
);
pass("managed issue fingerprint is stable");

const renamed = mockRequest([
  {
    number: 41,
    state: "open",
    title: "Owner renamed this decision",
    body: `${ISSUE_MARKER}\nstale body`
  }
]);
const renamedResult = await reportOwnerBlocker({
  request: renamed.request,
  environment,
  log() {}
});
assert(renamedResult.action === "updated" && renamedResult.number === 41, "renamed issue was not reused");
const renamedWrite = renamed.calls.find((call) => call.options.method === "PATCH");
assert(renamedWrite && !Object.hasOwn(renamedWrite.options.body, "title"), "renamed title was overwritten");
assert(!renamed.calls.some((call) => call.options.method === "POST"), "renamed issue created a duplicate");
pass("renamed marker-bound issue is updated without title identity");

const collision = mockRequest([
  {
    number: 42,
    state: "open",
    title: DEFAULT_TITLE,
    body: "Unrelated issue without the managed fingerprint"
  }
]);
await expectRejects(
  "unmarked same-title issue collision is refused",
  () => reportOwnerBlocker({ request: collision.request, environment, log() {} }),
  /unmarked title collision/u
);
assert(
  !collision.calls.some((call) => ["POST", "PATCH"].includes(call.options.method)),
  "title collision caused a write"
);

const duplicate = mockRequest([
  { number: 43, state: "open", title: "First", body: ISSUE_MARKER },
  { number: 44, state: "open", title: "Second", body: ISSUE_MARKER }
]);
await expectRejects(
  "duplicate managed markers are refused",
  () => reportOwnerBlocker({ request: duplicate.request, environment, log() {} }),
  /2 issues with the managed marker/u
);
assert(
  !duplicate.calls.some((call) => ["POST", "PATCH"].includes(call.options.method)),
  "duplicate markers caused a write"
);

const closed = mockRequest([
  { number: 45, state: "closed", title: "Resolved owner decision", body: ISSUE_MARKER }
]);
await expectRejects(
  "closed managed marker is not reopened or duplicated",
  () => reportOwnerBlocker({ request: closed.request, environment, log() {} }),
  /closed; refusing to reopen or duplicate/u
);
assert(
  !closed.calls.some((call) => ["POST", "PATCH"].includes(call.options.method)),
  "closed managed issue caused a write"
);

console.log(`RESULT PASS: ${checks} adversarial repository regressions passed.`);
