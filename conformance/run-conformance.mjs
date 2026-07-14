#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const casesPath = join(directory, "golden-cases.json");
const waiversPath = join(directory, "waivers.json");
const verdicts = new Set(["DRIFT", "CLEAN", "WAIVED"]);
const requiredClasses = [
  "catalog-outran-reality",
  "mirror-divergence",
  "schema-version-lag",
  "rappid-invariant-violation",
  "bible-pin-stale",
  "kernel-pin-lag",
  "name-collision-unnamed",
  "private-name-leak"
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function loadJson(path) {
  const text = await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

function requireString(value, field) {
  invariant(typeof value === "string" && value.length > 0, `${field} must be a non-empty string`);
}

function validateDate(value, field) {
  requireString(value, field);
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(value), `${field} must use YYYY-MM-DD`);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  invariant(
    parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day,
    `${field} is not a valid date`
  );
}

function validateWaivers(document) {
  invariant(document && typeof document === "object", "waivers.json must contain an object");
  invariant(Array.isArray(document.waivers), "waivers.json.waivers must be an array");

  const ids = new Set();
  for (const [index, waiver] of document.waivers.entries()) {
    const prefix = `waivers[${index}]`;
    for (const field of ["id", "case_or_finding", "why_intentional", "approved_by"]) {
      requireString(waiver[field], `${prefix}.${field}`);
    }
    validateDate(waiver.date, `${prefix}.date`);
    if (waiver.expires !== undefined) {
      validateDate(waiver.expires, `${prefix}.expires`);
      invariant(waiver.expires >= waiver.date, `${prefix}.expires cannot precede date`);
    }
    invariant(!ids.has(waiver.id), `duplicate waiver id: ${waiver.id}`);
    ids.add(waiver.id);
  }
}

function validateCases(document) {
  invariant(document && typeof document === "object", "golden-cases.json must contain an object");
  invariant(document.format_version === 1, "golden-cases.json format_version must be 1");
  invariant(Array.isArray(document.cases) && document.cases.length > 0, "cases must be a non-empty array");

  const ids = new Set();
  const classes = new Set();
  let historicalCount = 0;

  for (const [index, testCase] of document.cases.entries()) {
    const prefix = `cases[${index}]`;
    for (const field of ["id", "class", "description"]) {
      requireString(testCase[field], `${prefix}.${field}`);
    }
    invariant(!ids.has(testCase.id), `duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
    classes.add(testCase.class);
    invariant(verdicts.has(testCase.expected_verdict), `${testCase.id} has an invalid expected_verdict`);
    invariant(testCase.fixture && typeof testCase.fixture === "object", `${testCase.id}.fixture must be an object`);
    invariant(
      testCase.expected_ruling && typeof testCase.expected_ruling === "object",
      `${testCase.id}.expected_ruling must be an object`
    );
    requireString(testCase.expected_ruling.citation, `${testCase.id}.expected_ruling.citation`);
    requireString(testCase.expected_ruling.rationale, `${testCase.id}.expected_ruling.rationale`);

    if (testCase.historical === true) {
      historicalCount += 1;
      requireString(testCase.source, `${testCase.id}.source`);
      invariant(testCase.resolved === "pending", `${testCase.id}.resolved must be "pending"`);
    }
  }

  for (const className of requiredClasses) {
    invariant(classes.has(className), `missing required drift class: ${className}`);
  }
  invariant(historicalCount >= 3, "at least three historical cases are required");
}

function judgment(fixture) {
  if (fixture.mode !== "judgment") {
    return null;
  }
  requireString(fixture.review_question, "judgment fixture.review_question");
  return {
    kind: "judgment",
    question: fixture.review_question
  };
}

function checkCatalog(fixture) {
  invariant(Array.isArray(fixture.catalog), "catalog fixture must include catalog[]");
  invariant(Array.isArray(fixture.resolutions), "catalog fixture must include resolutions[]");
  const liveStatuses = new Set(["active", "live", "shipped"]);
  const unresolved = [];

  for (const item of fixture.catalog) {
    requireString(item.id, "catalog item.id");
    requireString(item.status, `catalog item ${item.id}.status`);
    if (!liveStatuses.has(item.status.toLowerCase())) {
      continue;
    }
    const resolved = fixture.resolutions.some(
      (observation) => observation.id === item.id && observation.resolved === true
    );
    if (!resolved) {
      unresolved.push(item.id);
    }
  }

  return {
    kind: "mechanical",
    verdict: unresolved.length > 0 ? "DRIFT" : "CLEAN",
    detail:
      unresolved.length > 0
        ? `${unresolved.length} live catalog item(s) lack a successful resolution: ${unresolved.join(", ")}`
        : "Every live catalog item has a successful resolution."
  };
}

function checkMirrors(fixture) {
  invariant(typeof fixture.canonical_text === "string", "mirror fixture.canonical_text must be a string");
  invariant(typeof fixture.mirror_text === "string", "mirror fixture.mirror_text must be a string");
  const canonicalDigest = sha256(fixture.canonical_text);
  const mirrorDigest = sha256(fixture.mirror_text);
  const equal = canonicalDigest === mirrorDigest;

  return {
    kind: "mechanical",
    verdict: equal ? "CLEAN" : "DRIFT",
    detail: equal
      ? `Mirror SHA-256 digests match (${canonicalDigest.slice(0, 12)}...).`
      : `Mirror SHA-256 digests differ (${canonicalDigest.slice(0, 12)}... != ${mirrorDigest.slice(0, 12)}...).`
  };
}

function checkSchemaVersion(fixture) {
  invariant(fixture.producer && typeof fixture.producer === "object", "schema fixture.producer is required");
  invariant(fixture.consumer && typeof fixture.consumer === "object", "schema fixture.consumer is required");
  requireString(fixture.producer.name, "schema producer.name");
  requireString(fixture.producer.version, "schema producer.version");
  requireString(fixture.consumer.name, "schema consumer.name");
  invariant(Array.isArray(fixture.consumer.accepted_versions), "schema consumer.accepted_versions must be an array");
  invariant(Array.isArray(fixture.producer.required_enum_values), "schema producer.required_enum_values must be an array");
  invariant(Array.isArray(fixture.consumer.enum_values), "schema consumer.enum_values must be an array");
  const accepted = fixture.consumer.accepted_versions.includes(fixture.producer.version);
  const sameContract = fixture.producer.name === fixture.consumer.name;
  const missingValues = fixture.producer.required_enum_values.filter(
    (value) => !fixture.consumer.enum_values.includes(value)
  );
  const clean = sameContract && accepted && missingValues.length === 0;
  const reasons = [];
  if (!sameContract) {
    reasons.push("Consumer names a different contract.");
  }
  if (!accepted) {
    reasons.push(`Consumer does not accept emitted version ${fixture.producer.version}.`);
  }
  if (missingValues.length > 0) {
    reasons.push(`Consumer enum is missing: ${missingValues.join(", ")}.`);
  }

  return {
    kind: "mechanical",
    verdict: clean ? "CLEAN" : "DRIFT",
    detail: clean
      ? `Consumer accepts ${fixture.producer.name} version ${fixture.producer.version} and its enum is a superset.`
      : reasons.join(" ")
  };
}

function checkRappid(fixture) {
  requireString(fixture.derivation, "rappid fixture.derivation");
  requireString(fixture.identifier, "rappid fixture.identifier");
  invariant(/^[0-9a-f]{64}$/.test(fixture.identifier), "rappid fixture.identifier must be 64 lowercase hex");

  let expected;
  if (fixture.derivation === "sha256(master_pubkey_SPKI)") {
    requireString(fixture.master_pubkey_spki, "rappid fixture.master_pubkey_spki");
    expected = sha256(fixture.master_pubkey_spki);
  } else if (fixture.derivation === "stable-uuid-derived") {
    requireString(fixture.stable_uuid, "rappid fixture.stable_uuid");
    invariant(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        fixture.stable_uuid
      ),
      "rappid fixture.stable_uuid must be an RFC 4122 UUID"
    );
    expected = sha256(fixture.stable_uuid.toLowerCase());
  } else {
    let detail = `Illegal rappid derivation: ${fixture.derivation}.`;
    if (fixture.derivation === "sha256(owner/slug)") {
      requireString(fixture.owner, "rappid fixture.owner");
      requireString(fixture.slug, "rappid fixture.slug");
      const illegalDigest = sha256(`${fixture.owner}/${fixture.slug}`);
      detail +=
        fixture.identifier === illegalDigest
          ? " Identifier exactly matches the forbidden owner/slug digest."
          : " Identifier declares the forbidden owner/slug derivation."
    }
    return {
      kind: "mechanical",
      verdict: "DRIFT",
      detail
    };
  }

  const clean = fixture.identifier === expected;
  return {
    kind: "mechanical",
    verdict: clean ? "CLEAN" : "DRIFT",
    detail: clean
      ? `Identifier matches ${fixture.derivation}.`
      : `Identifier does not match ${fixture.derivation}.`
  };
}

function checkBiblePin(fixture) {
  requireString(fixture.ecosystem_spec_version, "Bible fixture.ecosystem_spec_version");
  requireString(fixture.bible_spec_version, "Bible fixture.bible_spec_version");
  const clean = fixture.ecosystem_spec_version === fixture.bible_spec_version;

  return {
    kind: "mechanical",
    verdict: clean ? "CLEAN" : "DRIFT",
    detail: clean
      ? `Bible pin matches ecosystem spec ${fixture.ecosystem_spec_version}.`
      : `Bible pin ${fixture.bible_spec_version} != ecosystem spec ${fixture.ecosystem_spec_version}.`
  };
}

function checkKernelPin(fixture) {
  for (const field of ["grail", "distribution", "pin"]) {
    invariant(fixture[field] && typeof fixture[field] === "object", `kernel fixture.${field} is required`);
  }
  for (const target of ["grail", "distribution"]) {
    requireString(fixture[target].version, `kernel ${target}.version`);
    requireString(fixture[target].digest, `kernel ${target}.digest`);
  }

  const current =
    fixture.distribution.version === fixture.grail.version &&
    fixture.distribution.digest === fixture.grail.digest;
  const enforcedIntentionalPin =
    fixture.pin.policy === "intentional-lts" &&
    fixture.pin.version === fixture.distribution.version &&
    fixture.pin.digest === fixture.distribution.digest &&
    fixture.pin.freeze_check === true;
  const clean = current || enforcedIntentionalPin;

  return {
    kind: "mechanical",
    verdict: clean ? "CLEAN" : "DRIFT",
    detail: current
      ? "Distribution matches the current grail kernel."
      : enforcedIntentionalPin
        ? `Distribution is intentionally pinned to ${fixture.distribution.version}; digest and freeze check agree.`
        : "Kernel differs from the grail without an enforced matching intentional-LTS pin."
  };
}

function normalizeName(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^(|n\/a|unknown|unnamed|untitled)$/.test(normalized) ? "__unnamed__" : normalized;
}

function checkNameCollision(fixture) {
  invariant(Array.isArray(fixture.records), "name-collision fixture.records must be an array");
  const seen = new Map();
  const collisions = new Set();

  for (const record of fixture.records) {
    requireString(record.id, "name-collision record.id");
    const normalized = normalizeName(record.name);
    if (seen.has(normalized)) {
      collisions.add(normalized);
    } else {
      seen.set(normalized, record.id);
    }
  }

  return {
    kind: "mechanical",
    verdict: collisions.size > 0 ? "DRIFT" : "CLEAN",
    detail:
      collisions.size > 0
        ? `${collisions.size} normalized name collision(s) detected.`
        : "All normalized names are unique."
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkPrivateNameLeak(fixture) {
  invariant(Array.isArray(fixture.private_names), "privacy fixture.private_names must be an array");
  invariant(typeof fixture.public_text === "string", "privacy fixture.public_text must be a string");
  let matchCount = 0;

  for (const privateName of fixture.private_names) {
    requireString(privateName, "privacy private_names[]");
    const pattern = new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(privateName)}(?=$|[^A-Za-z0-9])`, "iu");
    if (pattern.test(fixture.public_text)) {
      matchCount += 1;
    }
  }

  return {
    kind: "mechanical",
    verdict: matchCount > 0 ? "DRIFT" : "CLEAN",
    detail:
      matchCount > 0
        ? `${matchCount} private identifier(s) occur on the public surface.`
        : "No private identifiers occur on the public surface."
  };
}

const checkers = {
  "catalog-outran-reality": checkCatalog,
  "mirror-divergence": checkMirrors,
  "schema-version-lag": checkSchemaVersion,
  "rappid-invariant-violation": checkRappid,
  "bible-pin-stale": checkBiblePin,
  "kernel-pin-lag": checkKernelPin,
  "name-collision-unnamed": checkNameCollision,
  "private-name-leak": checkPrivateNameLeak
};

function activeWaiverFor(testCase, waivers, now) {
  return waivers.find((waiver) => {
    if (waiver.case_or_finding !== testCase.id) {
      return false;
    }
    if (waiver.expires === undefined) {
      return true;
    }
    return Date.parse(`${waiver.expires}T23:59:59.999Z`) >= now.getTime();
  });
}

function applyWaiver(testCase, outcome, waivers, now) {
  if (outcome.verdict !== "DRIFT") {
    return outcome;
  }
  const waiver = activeWaiverFor(testCase, waivers, now);
  if (!waiver) {
    return outcome;
  }
  return {
    ...outcome,
    verdict: "WAIVED",
    detail: `${outcome.detail} Active waiver: ${waiver.id}.`
  };
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  invariant(nodeMajor >= 20, `Node >=20 is required; found ${process.versions.node}`);

  const [caseDocument, waiverDocument] = await Promise.all([loadJson(casesPath), loadJson(waiversPath)]);
  validateCases(caseDocument);
  validateWaivers(waiverDocument);

  const now = new Date();
  const activeWaivers = waiverDocument.waivers.filter(
    (waiver) =>
      waiver.expires === undefined || Date.parse(`${waiver.expires}T23:59:59.999Z`) >= now.getTime()
  );
  const results = [];

  for (const testCase of caseDocument.cases) {
    const judgmentOutcome = judgment(testCase.fixture);
    if (judgmentOutcome) {
      results.push({ testCase, outcome: judgmentOutcome });
      continue;
    }
    const checker = checkers[testCase.class];
    invariant(checker, `no checker is registered for ${testCase.class}`);
    const outcome = applyWaiver(testCase, checker(testCase.fixture), waiverDocument.waivers, now);
    results.push({ testCase, outcome });
  }

  const mechanical = results.filter(({ outcome }) => outcome.kind === "mechanical");
  const judgmentRequired = results.filter(({ outcome }) => outcome.kind === "judgment");
  let failures = 0;

  console.log("RAPP golden drift conformance");
  console.log(
    `cases=${results.length} mechanical=${mechanical.length} judge-required=${judgmentRequired.length} active-waivers=${activeWaivers.length}`
  );
  console.log();

  for (const { testCase, outcome } of results) {
    if (outcome.kind === "judgment") {
      console.log(`JUDGE-REQUIRED ${testCase.id} [${testCase.class}] expected=${testCase.expected_verdict}`);
      console.log(`  question: ${outcome.question}`);
      continue;
    }

    const passed = outcome.verdict === testCase.expected_verdict;
    if (!passed) {
      failures += 1;
    }
    console.log(
      `${passed ? "PASS" : "FAIL"} ${testCase.id} [${testCase.class}] expected=${testCase.expected_verdict} actual=${outcome.verdict}`
    );
    console.log(`  ${outcome.detail}`);
  }

  console.log();
  if (failures === 0) {
    console.log(
      `RESULT PASS: ${mechanical.length}/${mechanical.length} mechanical checks matched; ${judgmentRequired.length} judgment item(s) require the stated review.`
    );
  } else {
    console.log(
      `RESULT FAIL: ${failures}/${mechanical.length} mechanical check(s) disagreed with their golden verdict.`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`CONFORMANCE ERROR: ${error.message}`);
  process.exitCode = 1;
});
