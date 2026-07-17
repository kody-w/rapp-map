import { createHash } from "node:crypto";

export const BASELINE_COMMIT = "baded0098d8b97c2876c0b8af4475cf3061b7ad0";
export const AUTHORITY = Object.freeze({
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
});

export const EVIDENCE_EXPECTATIONS = Object.freeze({
  "estate-map.json": Object.freeze({
    payload_schema: "rapp-estate-map/1.0",
    classification: "historical-observation",
    captured_at: "2026-06-28T20:21:23Z",
    record_count: 92,
    bytes: 366229,
    sha256: "b557ce7b3855658124252d8b4cb60af2ec56fb52ebc27e7fb0069f15251605a1"
  }),
  "neurons.json": Object.freeze({
    payload_schema: "rapp-neuron-mesh/1.0",
    classification: "historical-observation",
    captured_at: "2026-06-28T20:03:35Z",
    record_count: 630,
    bytes: 2484245,
    sha256: "52cbb3d5db3a79364d23dc8b9d0554e411996af312dfb7b1a03207073707d1eb"
  }),
  "neurons-manifest.json": Object.freeze({
    payload_schema: "rapp-neuron-mesh-manifest/1.0",
    classification: "historical-observation-index",
    captured_at: "2026-06-28T20:03:35Z",
    record_count: 630,
    bytes: 339458,
    sha256: "9918344e75fcdcf4dba73da8b2bc0a165c6ed5659a58508f4de608a11ffd255a"
  })
});

export const WORKFLOW_PINS = Object.freeze({
  "actions/checkout": "34e114876b0b11c390a56381ad16ebd13914f8d5",
  "actions/setup-node": "49933ea5288caeca8642d1e84afbd3f7d6820020"
});

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateHistoricalObservations(sidecar, fileBytes) {
  invariant(
    sidecar?.schema === "rapp-map-historical-observations/1.0",
    "historical sidecar schema must be rapp-map-historical-observations/1.0"
  );
  invariant(sidecar.document_type === "historical-observation-disposition", "sidecar type drifted");
  invariant(sidecar.baseline_commit === BASELINE_COMMIT, "historical sidecar baseline commit drifted");
  invariant(sidecar.authority_pin === "RAPP1_AUTHORITY.json", "historical sidecar authority pin drifted");
  invariant(sidecar.authoritative === false, "historical sidecar must be non-authoritative");
  invariant(sidecar.rapp1_registry === false, "historical sidecar must not be a RAPP/1 registry");
  invariant(sidecar.registry_provenance === null, "historical sidecar has no section 13 provenance");
  invariant(Array.isArray(sidecar.observations), "historical sidecar observations must be an array");

  const expectedPaths = Object.keys(EVIDENCE_EXPECTATIONS);
  invariant(
    sidecar.observations.length === expectedPaths.length,
    "historical sidecar must describe exactly three observations"
  );
  const entries = new Map();
  for (const entry of sidecar.observations) {
    invariant(entry && typeof entry === "object", "historical sidecar entry must be an object");
    invariant(!entries.has(entry.path), `duplicate historical sidecar path: ${entry.path}`);
    entries.set(entry.path, entry);
  }

  for (const path of expectedPaths) {
    const expected = EVIDENCE_EXPECTATIONS[path];
    const entry = entries.get(path);
    invariant(entry, `historical sidecar is missing ${path}`);
    for (const [field, value] of Object.entries(expected)) {
      invariant(entry[field] === value, `${path} sidecar ${field} drifted`);
    }
    invariant(entry.authoritative === false, `${path} sidecar entry must be non-authoritative`);
    invariant(entry.rapp1_registry === false, `${path} sidecar entry must not be a registry`);

    const bytes = fileBytes[path];
    invariant(Buffer.isBuffer(bytes), `${path} bytes were not supplied to the validator`);
    invariant(bytes.length === expected.bytes, `${path} no longer has the baseline byte length`);
    invariant(sha256(bytes) === expected.sha256, `${path} no longer matches the baseline SHA-256`);
    let payload;
    try {
      payload = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw new Error(`${path} is not valid historical JSON: ${error.message}`);
    }
    invariant(!Object.hasOwn(payload, "_disposition"), `${path} payload bytes contain live disposition data`);
    invariant(payload.schema === expected.payload_schema, `${path} historical schema token changed`);
    invariant(payload.built_at === expected.captured_at, `${path} historical capture time changed`);
    invariant(payload.count === expected.record_count, `${path} historical record count changed`);
  }
}

const GRAPH_NODES = Object.freeze({
  "rapp-1": Object.freeze({
    repo: "kody-w/rapp-1",
    classification: "protocol-authority",
    protocol_authority: true,
    federal_canonical_source: false
  }),
  RAPP: Object.freeze({
    repo: "kody-w/RAPP",
    classification: "federal-canonical-source",
    protocol_authority: false,
    federal_canonical_source: true
  }),
  "rapp-map": Object.freeze({
    repo: "kody-w/rapp-map",
    classification: "router-mirror",
    protocol_authority: false,
    federal_canonical_source: false
  }),
  "rapp-god": Object.freeze({
    repo: "kody-w/rapp-god",
    classification: "observation-mirror",
    protocol_authority: false,
    federal_canonical_source: false
  }),
  "RAPP-Bible": Object.freeze({
    repo: "kody-w/RAPP-Bible",
    classification: "documentation-mirror",
    protocol_authority: false,
    federal_canonical_source: false
  })
});

const GRAPH_EDGES = new Set([
  "RAPP|rapp-1|conforms_to",
  "rapp-map|rapp-1|conforms_to",
  "rapp-map|RAPP|subordinate_to",
  "rapp-god|rapp-1|conforms_to",
  "rapp-god|RAPP|subordinate_to",
  "RAPP-Bible|rapp-1|conforms_to",
  "RAPP-Bible|RAPP|subordinate_to"
]);

export function validateGraphDocument(graph) {
  invariant(graph?.document_type === "repository-relationship-map", "graph document type drifted");
  invariant(graph.format_version === 2, "graph format_version must be 2 after the edge-shape change");
  invariant(graph.generation === "deterministic-network-free", "graph generation disposition drifted");
  invariant(graph.disposition?.authoritative === false, "graph must be non-authoritative");
  invariant(graph.disposition?.rapp1_registry === false, "graph must not be a RAPP/1 registry");
  invariant(graph.disposition?.registry_provenance === null, "graph has no section 13 provenance");
  invariant(graph.disposition?.owner_acceptance === false, "graph cannot claim owner acceptance");
  invariant(
    graph.protocol_authority?.repository === AUTHORITY.repository &&
      graph.protocol_authority?.commit === AUTHORITY.commit &&
      graph.protocol_authority?.sha256 === AUTHORITY.sha256,
    "graph protocol authority pin drifted"
  );
  invariant(
    graph.federal_canonical_source?.repository === "kody-w/RAPP" &&
      graph.federal_canonical_source?.commit === null,
    "graph federal canonical source must be unpinned kody-w/RAPP without provenance claims"
  );
  invariant(
    graph.edge_semantics?.conforms_to?.includes("technical") &&
      graph.edge_semantics?.subordinate_to?.includes("section 11"),
    "graph edge semantics must distinguish technical conformance from federal subordination"
  );

  invariant(Array.isArray(graph.nodes), "graph.nodes must be an array");
  invariant(graph.nodes.length === Object.keys(GRAPH_NODES).length, "graph node set drifted");
  const nodes = new Map();
  for (const node of graph.nodes) {
    invariant(!nodes.has(node.id), `duplicate graph node: ${node.id}`);
    nodes.set(node.id, node);
  }
  for (const [id, expected] of Object.entries(GRAPH_NODES)) {
    const node = nodes.get(id);
    invariant(node, `graph is missing node ${id}`);
    for (const [field, value] of Object.entries(expected)) {
      invariant(node[field] === value, `graph node ${id}.${field} drifted`);
    }
  }
  invariant(nodes.get("rapp-1").pinned_commit === AUTHORITY.commit, "rapp-1 node pin drifted");
  invariant(nodes.get("RAPP").pinned_commit === null, "RAPP must not claim an unavailable content pin");

  invariant(Array.isArray(graph.edges), "graph.edges must be an array");
  const edges = new Set(
    graph.edges.map((edge) => `${edge.from}|${edge.to}|${edge.type}`)
  );
  invariant(edges.size === graph.edges.length, "graph contains duplicate edges");
  invariant(edges.size === GRAPH_EDGES.size, "graph edge set has a removal or addition");
  for (const edge of GRAPH_EDGES) {
    invariant(edges.has(edge), `graph is missing required edge ${edge}`);
  }
  invariant(
    graph.edges
      .filter((edge) => edge.type === "conforms_to")
      .every((edge) => edge.to === "rapp-1"),
    "technical conforms_to edges must target kody-w/rapp-1"
  );
  invariant(
    graph.edges
      .filter((edge) => edge.type === "subordinate_to")
      .every((edge) => edge.to === "RAPP"),
    "section 11 subordinate_to edges must target kody-w/RAPP"
  );
}

export function validateWorkflowSources(sources) {
  invariant(
    sources && typeof sources === "object" && Object.keys(sources).length === 2,
    "exactly two workflow sources are required"
  );
  let usesCount = 0;
  for (const [path, source] of Object.entries(sources)) {
    const uses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gmu)].map(
      (match) => match[1]
    );
    invariant(uses.length >= 2, `${path} must use direct checkout and setup-node actions`);
    for (const reference of uses) {
      usesCount += 1;
      const at = reference.lastIndexOf("@");
      invariant(at > 0, `${path} has an unpinned reference: ${reference}`);
      const action = reference.slice(0, at);
      const pin = reference.slice(at + 1);
      invariant(Object.hasOwn(WORKFLOW_PINS, action), `${path} uses external or nested workflow ${action}`);
      invariant(pin === WORKFLOW_PINS[action], `${path} uses the wrong immutable pin for ${action}`);
    }
    invariant(
      source.includes("bash .github/scripts/run-offline-gates.sh"),
      `${path} must execute the reviewed local gate runner`
    );
    invariant(
      source.includes("fetch-depth: 0"),
      `${path} must fetch full history to compare the fixed baseline evidence blobs`
    );
  }

  const drift = sources[".github/workflows/drift-lint.yml"];
  const guard = sources[".github/workflows/standing-guard.yml"];
  invariant(drift?.includes("permissions: { contents: read }"), "drift workflow must be read-only");
  invariant(/^permissions:\s*\{\}\s*$/mu.test(guard ?? ""), "standing guard must default to no permissions");
  invariant(!/contents:\s*write/u.test(guard ?? ""), "standing guard must not write repository contents");
  invariant(
    ((guard ?? "").match(/issues:\s*write/gu) ?? []).length === 1,
    "only the explicit report job may write issues"
  );
  return usesCount;
}
