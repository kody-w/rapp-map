import { createHash, createPublicKey } from "node:crypto";

const RAPPID_SPACE = "rapp/1:rappid";
const AUTHORITY_COMMIT = "6723c7add2aed36bb68992fc71a56b0a4bd5ad81";
const AUTHORITY_SHA256 =
  "6d06daba65d7c045716f3d6e95db8401ab58e727820e4114466d847f62cae49b";

export const REQUIRED_VECTORS = Object.freeze({
  "rev5-keyless-uuid4-raw-octets": Object.freeze({
    verdict: "CLEAN",
    digest: "522d52fb5a83b437352e3391de74ab72ffb545dad0ee7a2d1000407cd11136cc",
    invariant: "uuid4-hb"
  }),
  "rev5-keyed-spki-der": Object.freeze({
    verdict: "CLEAN",
    digest: "1e9286fcf45faa74c1411ed1e70c9d7e7607cbd0bbcb4f0bd3e63e64e61baa39",
    invariant: "spki-hb-exact"
  }),
  "rev5-forbid-spki-trailing-one-byte": Object.freeze({
    verdict: "DRIFT",
    digest: "38481cc56b49470621249b337fd2fc757049a5bc9e436814d1c8b1bdd1e539ba",
    invariant: "spki-der-refused"
  }),
  "rev5-forbid-spki-trailing-four-bytes": Object.freeze({
    verdict: "DRIFT",
    digest: "647247861408f8bc1b220b77da6e72bb99252a6db7b0f13ddfd62e77280c6483",
    invariant: "spki-der-refused"
  }),
  "rev5-forbid-spki-malformed-length": Object.freeze({
    verdict: "DRIFT",
    digest: "8796882e7906fb1a9da75ecd97667fad8d902162e69d3c667c99d0a80343bf71",
    invariant: "spki-der-refused"
  }),
  "rev5-forbid-untagged-spki-sha256": Object.freeze({
    verdict: "DRIFT",
    digest: "900de8b6e46a80fd0788a201ab1d7fa9f677e9fa97e5897b1199b77612d04135",
    invariant: "forbidden-derivation"
  }),
  "rev5-forbid-uuid-text-sha256": Object.freeze({
    verdict: "DRIFT",
    digest: "8d246b85d9544581d16c03b657278924adeddccd78d57d6bba25108279a9cd47",
    invariant: "forbidden-derivation"
  }),
  "rev5-forbid-owner-slug-sha256": Object.freeze({
    verdict: "DRIFT",
    digest: "533e5443a456db54c8c0695a309b06eb7165a527ddbc8f901fca8c15926db8db",
    invariant: "forbidden-derivation"
  }),
  "rev5-forbid-legacy-v2-grammar": Object.freeze({
    verdict: "DRIFT",
    digest: "713861e60447a0a62cf9c38b94ace3e7167dce90404ede9c649b71cc1a4c8a74",
    invariant: "grammar-refused:legacy-v2-grammar"
  }),
  "rev5-forbid-bare-slug-grammar": Object.freeze({
    verdict: "DRIFT",
    digest: "74e7fcd505852b252f3b302b5bd6d28cbb6581d66fe7276ca47831b44fe32056",
    invariant: "grammar-refused:bare-slug-grammar"
  }),
  "rev5-forbid-uppercase-tail": Object.freeze({
    verdict: "DRIFT",
    digest: "7972558c82c7183cbebcc912beaf88a404977681beff5f2b9d9ed5ee34742240",
    invariant: "grammar-refused:uppercase-tail"
  }),
  "rev5-forbid-short-tail": Object.freeze({
    verdict: "DRIFT",
    digest: "021939d216eb1fda64a7b412e6202a814c1bc255e15d2fd8fa7a1ab24c307b04",
    invariant: "grammar-refused:short-tail"
  }),
  "rev5-forbid-uppercase-owner": Object.freeze({
    verdict: "DRIFT",
    digest: "3348838271762a7f125d5b3a5d2eb4e4166927f70c9f44de99b89d062ad5920d",
    invariant: "grammar-refused:uppercase-owner"
  }),
  "rev5-forbid-adjacent-hyphen": Object.freeze({
    verdict: "DRIFT",
    digest: "28f0b66b46d035e5ef93821b65470ea027acb20a6329c47542855bd6de394e44",
    invariant: "grammar-refused:adjacent-hyphen"
  })
});

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

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function normalizedFixtureDigest(testCase) {
  const normalized = {
    rappid: testCase.rappid,
    mint: testCase.mint,
    mutation: testCase.mutation ?? null
  };
  return sha256(Buffer.from(canonicalJson(normalized), "utf8"));
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

export function parseRappid(value) {
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

function exactSpkiBytes(value, field = "mint.spki_der_b64") {
  const spki = decodeBase64(value, field);
  let key;
  try {
    key = createPublicKey({ key: spki, format: "der", type: "spki" });
  } catch (error) {
    throw new Error(`${field} is not DER SubjectPublicKeyInfo: ${error.message}`);
  }
  const exported = key.export({ format: "der", type: "spki" });
  invariant(Buffer.isBuffer(exported), `${field} did not export as DER bytes`);
  invariant(
    exported.equals(spki),
    `${field} must contain exactly one canonical DER SubjectPublicKeyInfo object`
  );
  return spki;
}

function allowedSpkiMint(mint) {
  return hb(RAPPID_SPACE, exactSpkiBytes(mint.spki_der_b64));
}

function forbiddenDigest(method, mint, parsed) {
  if (method === "sha256-spki-untagged") {
    return sha256(exactSpkiBytes(mint.spki_der_b64));
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

const grammarMutations = Object.freeze({
  "legacy-v2-grammar": ({ owner, slug, tail }) =>
    `rappid:v2:twin:@${owner}/${slug}:${tail}@github.com/${owner}/${slug}`,
  "bare-slug-grammar": ({ slug, tail }) => `rappid:${slug}:${tail}`,
  "uppercase-tail": ({ owner, slug, tail }) =>
    `rappid:@${owner}/${slug}:${tail.toUpperCase()}`,
  "short-tail": ({ owner, slug, tail }) => `rappid:@${owner}/${slug}:${tail.slice(0, 32)}`,
  "uppercase-owner": ({ owner, slug, tail }) =>
    `rappid:@${owner[0].toUpperCase()}${owner.slice(1)}/${slug}:${tail}`,
  "adjacent-hyphen": ({ owner, slug, tail }) =>
    `rappid:@${owner.replace("-", "--")}/${slug}:${tail}`
});

function validateGrammarMutation(testCase, casesById, binding) {
  const kind = binding.invariant.slice("grammar-refused:".length);
  invariant(testCase.mutation?.kind === kind, `${testCase.id} mutation kind must be ${kind}`);
  const control = casesById.get(testCase.mutation?.control_id);
  invariant(control, `${testCase.id} references a missing mutation control`);
  invariant(
    testCase.mutation.control_id === "rev5-keyless-uuid4-raw-octets",
    `${testCase.id} must mutate the pinned valid keyless control`
  );
  const parsedControl = parseRappid(control.rappid);
  invariant(parsedControl, `${testCase.id} control is not valid rev-5 grammar`);
  invariant(
    canonicalJson(testCase.mint) === canonicalJson(control.mint),
    `${testCase.id} must preserve the control's identity material`
  );
  const mutate = grammarMutations[kind];
  invariant(mutate, `${testCase.id} names an unknown grammar mutation`);
  invariant(
    testCase.rappid === mutate(parsedControl),
    `${testCase.id} is not the exact ${kind} mutation of its control`
  );
  invariant(parseRappid(testCase.rappid) === null, `${testCase.id} mutation did not violate grammar`);
}

export function validateDocument(document) {
  invariant(document && typeof document === "object", "golden-cases.json must contain an object");
  invariant(document.format_version === 3, "golden-cases.json format_version must be 3");
  invariant(document.authority?.commit === AUTHORITY_COMMIT, "golden cases authority commit drifted");
  invariant(
    document.authority?.spec_sha256 === AUTHORITY_SHA256,
    "golden cases authority digest drifted"
  );
  invariant(Array.isArray(document.cases), "golden-cases.json.cases must be an array");
  invariant(
    document.cases.length === Object.keys(REQUIRED_VECTORS).length,
    "golden cases must contain exactly the independently pinned required vectors"
  );

  const casesById = new Map();
  for (const [index, testCase] of document.cases.entries()) {
    const prefix = `cases[${index}]`;
    requireString(testCase.id, `${prefix}.id`);
    requireString(testCase.description, `${prefix}.description`);
    requireString(testCase.rappid, `${prefix}.rappid`);
    requireString(testCase.expected_rule, `${prefix}.expected_rule`);
    invariant(!casesById.has(testCase.id), `duplicate case id: ${testCase.id}`);
    const binding = REQUIRED_VECTORS[testCase.id];
    invariant(binding, `unbound vector id: ${testCase.id}`);
    invariant(
      testCase.expected_verdict === binding.verdict,
      `${testCase.id} verdict differs from the independently pinned verdict`
    );
    invariant(
      normalizedFixtureDigest(testCase) === binding.digest,
      `${testCase.id} normalized fixture differs from its immutable digest`
    );
    casesById.set(testCase.id, testCase);
  }

  for (const [id, binding] of Object.entries(REQUIRED_VECTORS)) {
    const testCase = casesById.get(id);
    invariant(testCase, `missing required rev-5 vector: ${id}`);
    if (binding.invariant.startsWith("grammar-refused:")) {
      validateGrammarMutation(testCase, casesById, binding);
    } else {
      invariant(testCase.mutation === undefined, `${id} must not declare a grammar mutation`);
    }
  }
}

export function evaluate(testCase) {
  const binding = REQUIRED_VECTORS[testCase.id];
  invariant(binding, `cannot evaluate unbound vector ${testCase.id}`);
  const parsed = parseRappid(testCase.rappid);
  if (!parsed) {
    return {
      verdict: "DRIFT",
      invariant: `grammar-refused:${testCase.mutation?.kind ?? "unbound"}`,
      detail: "Identifier is outside the exact case-sensitive rev-5 grammar."
    };
  }

  invariant(
    testCase.mint && typeof testCase.mint === "object" && !Array.isArray(testCase.mint),
    `${testCase.id}.mint must describe identity material`
  );
  requireString(testCase.mint.method, `${testCase.id}.mint.method`);

  let expectedTail;
  try {
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
        invariant: "forbidden-derivation",
        detail: `${testCase.mint.method} is forbidden; rev-5 requires Hb("${RAPPID_SPACE}", raw bytes).`
      };
    }
  } catch (error) {
    return {
      verdict: "DRIFT",
      invariant: "spki-der-refused",
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const clean = parsed.tail === expectedTail;
  return {
    verdict: clean ? "CLEAN" : "DRIFT",
    invariant: testCase.mint.method === "spki-der" ? "spki-hb-exact" : "uuid4-hb",
    detail: clean
      ? `Grammar and Hb("${RAPPID_SPACE}", exact raw bytes) match.`
      : `Tail does not equal Hb("${RAPPID_SPACE}", exact raw bytes); expected ${expectedTail}.`
  };
}
