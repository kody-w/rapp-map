#!/usr/bin/env node

import { createHash, createPublicKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const casesPath = join(directory, "golden-cases.json");
const RAPPID_SPACE = "rapp/1:rappid";
const AUTHORITY_COMMIT = "6723c7add2aed36bb68992fc71a56b0a4bd5ad81";
const AUTHORITY_SHA256 =
  "6d06daba65d7c045716f3d6e95db8401ab58e727820e4114466d847f62cae49b";
const requiredCases = new Set([
  "rev5-keyless-uuid4-raw-octets",
  "rev5-keyed-spki-der",
  "rev5-forbid-untagged-spki-sha256",
  "rev5-forbid-uuid-text-sha256",
  "rev5-forbid-owner-slug-sha256",
  "rev5-forbid-legacy-v2-grammar",
  "rev5-forbid-bare-slug-grammar",
  "rev5-forbid-uppercase-tail",
  "rev5-forbid-short-tail",
  "rev5-forbid-uppercase-owner",
  "rev5-forbid-adjacent-hyphen"
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireString(value, field) {
  invariant(typeof value === "string" && value.length > 0, `${field} must be a non-empty string`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hb(space, bytes) {
  return createHash("sha256")
    .update(Buffer.from(space, "ascii"))
    .update(Buffer.from([0x0a]))
    .update(bytes)
    .digest("hex");
}

function decodeHex(value, field, expectedBytes) {
  requireString(value, field);
  invariant(/^(?:[0-9a-f]{2})+$/.test(value), `${field} must be even-length lowercase hex`);
  const bytes = Buffer.from(value, "hex");
  invariant(bytes.length === expectedBytes, `${field} must encode ${expectedBytes} bytes`);
  return bytes;
}

function decodeBase64(value, field) {
  requireString(value, field);
  invariant(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),
    `${field} must be canonical base64`
  );
  const bytes = Buffer.from(value, "base64");
  invariant(bytes.toString("base64") === value, `${field} must be canonical base64`);
  return bytes;
}

function validateUuid4(value, field) {
  requireString(value, field);
  invariant(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    ),
    `${field} must be a lowercase RFC 9562 UUIDv4`
  );
}

function validLabel(value, maximumLength) {
  return (
    value.length >= 1 &&
    value.length <= maximumLength &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function parseRappid(value) {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^rappid:@([^/]+)\/([^:]+):([^:]+)$/.exec(value);
  if (!match) {
    return null;
  }
  const [, owner, slug, tail] = match;
  if (!validLabel(owner, 39) || !validLabel(slug, 100) || !/^[0-9a-f]{64}$/.test(tail)) {
    return null;
  }
  return { owner, slug, tail };
}

function allowedUuidMint(mint) {
  validateUuid4(mint.uuid, "mint.uuid");
  const uuidBytes = decodeHex(mint.uuid_octets_hex, "mint.uuid_octets_hex", 16);
  invariant(
    mint.uuid.replaceAll("-", "") === mint.uuid_octets_hex,
    "mint.uuid_octets_hex must be the UUID's RFC 9562 field-order octets"
  );
  return hb(RAPPID_SPACE, uuidBytes);
}

function allowedSpkiMint(mint) {
  const spki = decodeBase64(mint.spki_der_b64, "mint.spki_der_b64");
  try {
    createPublicKey({ key: spki, format: "der", type: "spki" });
  } catch (error) {
    throw new Error(`mint.spki_der_b64 is not DER SubjectPublicKeyInfo: ${error.message}`);
  }
  return hb(RAPPID_SPACE, spki);
}

function forbiddenDigest(method, mint, parsed) {
  if (method === "sha256-spki-untagged") {
    return sha256(decodeBase64(mint.spki_der_b64, "mint.spki_der_b64"));
  }
  if (method === "sha256-uuid-text") {
    validateUuid4(mint.uuid, "mint.uuid");
    return sha256(Buffer.from(mint.uuid, "utf8"));
  }
  if (method === "sha256-owner-slug") {
    return sha256(Buffer.from(`${parsed.owner}/${parsed.slug}`, "utf8"));
  }
  return null;
}

function evaluate(testCase) {
  const parsed = parseRappid(testCase.rappid);
  if (!parsed) {
    return {
      verdict: "DRIFT",
      detail: "Identifier is outside the exact case-sensitive rev-5 grammar."
    };
  }

  invariant(
    testCase.mint && typeof testCase.mint === "object" && !Array.isArray(testCase.mint),
    `${testCase.id}.mint must describe the identity material for a grammatical identifier`
  );
  requireString(testCase.mint.method, `${testCase.id}.mint.method`);

  let expectedTail;
  if (testCase.mint.method === "uuid4-octets") {
    expectedTail = allowedUuidMint(testCase.mint);
  } else if (testCase.mint.method === "spki-der") {
    expectedTail = allowedSpkiMint(testCase.mint);
  } else {
    const demonstratedDigest = forbiddenDigest(testCase.mint.method, testCase.mint, parsed);
    invariant(
      demonstratedDigest !== null,
      `${testCase.id}.mint.method is not a recognized structural vector`
    );
    invariant(
      parsed.tail === demonstratedDigest,
      `${testCase.id} does not contain the digest its forbidden method declares`
    );
    return {
      verdict: "DRIFT",
      detail: `${testCase.mint.method} is forbidden; rev-5 requires Hb("${RAPPID_SPACE}", raw bytes).`
    };
  }

  const clean = parsed.tail === expectedTail;
  return {
    verdict: clean ? "CLEAN" : "DRIFT",
    detail: clean
      ? `Grammar and Hb("${RAPPID_SPACE}", raw bytes) match.`
      : `Tail does not equal Hb("${RAPPID_SPACE}", raw bytes); expected ${expectedTail}.`
  };
}

async function loadDocument() {
  const text = await readFile(casesPath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`golden-cases.json is not valid JSON: ${error.message}`);
  }
}

function validateDocument(document) {
  invariant(document && typeof document === "object", "golden-cases.json must contain an object");
  invariant(document.format_version === 2, "golden-cases.json format_version must be 2");
  invariant(document.authority?.commit === AUTHORITY_COMMIT, "golden cases authority commit drifted");
  invariant(
    document.authority?.spec_sha256 === AUTHORITY_SHA256,
    "golden cases authority digest drifted"
  );
  invariant(Array.isArray(document.cases), "golden-cases.json.cases must be an array");

  const ids = new Set();
  for (const [index, testCase] of document.cases.entries()) {
    const prefix = `cases[${index}]`;
    requireString(testCase.id, `${prefix}.id`);
    requireString(testCase.description, `${prefix}.description`);
    requireString(testCase.rappid, `${prefix}.rappid`);
    requireString(testCase.expected_rule, `${prefix}.expected_rule`);
    invariant(
      testCase.expected_verdict === "CLEAN" || testCase.expected_verdict === "DRIFT",
      `${prefix}.expected_verdict must be CLEAN or DRIFT`
    );
    invariant(!ids.has(testCase.id), `duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
  }
  for (const id of requiredCases) {
    invariant(ids.has(id), `missing required rev-5 vector: ${id}`);
  }
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  invariant(nodeMajor >= 20, `Node >=20 is required; found ${process.versions.node}`);

  const document = await loadDocument();
  validateDocument(document);
  let failures = 0;

  console.log("RAPP/1 rev-5 identity conformance");
  console.log(`cases=${document.cases.length} scope=structural-only owner-acceptance=not-evaluated`);
  console.log();

  for (const testCase of document.cases) {
    const outcome = evaluate(testCase);
    const passed = outcome.verdict === testCase.expected_verdict;
    failures += passed ? 0 : 1;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${testCase.id} expected=${testCase.expected_verdict} actual=${outcome.verdict}`
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
    `RESULT PASS: ${document.cases.length}/${document.cases.length} structural vectors matched; no owner or registry acceptance was inferred.`
  );
}

main().catch((error) => {
  console.error(`CONFORMANCE ERROR: ${error.message}`);
  process.exitCode = 1;
});
