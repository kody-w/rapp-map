#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const waiversPath = join(directory, "waivers.json");
const requiredFields = [
  "id",
  "case_or_finding",
  "why_intentional",
  "approved_by",
  "date",
  "canon_url",
  "passage",
  "passage_sha256"
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireString(value, field, { trim = true } = {}) {
  invariant(typeof value === "string", `${field} must be a string`);
  invariant((trim ? value.trim() : value).length > 0, `${field} must be non-empty`);
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

function validateCanonUrl(value, field) {
  requireString(value, field);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }

  invariant(url.protocol === "https:", `${field} must use HTTPS`);
  invariant(!url.username && !url.password && !url.search && !url.hash, `${field} must be canonical`);

  const rawCanon =
    url.hostname === "raw.githubusercontent.com" &&
    url.pathname.split("/").filter(Boolean).length >= 4;
  const openIssueMarker =
    url.hostname === "api.github.com" &&
    /^\/repos\/[^/]+\/[^/]+\/issues\/\d+$/.test(url.pathname);
  invariant(
    rawCanon || openIssueMarker,
    `${field} must be a raw.githubusercontent.com file or GitHub issue API URL`
  );
}

function validateWaivers(document) {
  invariant(
    document !== null && typeof document === "object" && !Array.isArray(document),
    "waivers.json must contain an object"
  );
  if (document.$comment !== undefined) {
    requireString(document.$comment, "waivers.json.$comment");
  }
  invariant(Array.isArray(document.waivers), "waivers.json.waivers must be an array");

  const ids = new Set();
  for (const [index, waiver] of document.waivers.entries()) {
    const prefix = `waivers[${index}]`;
    invariant(
      waiver !== null && typeof waiver === "object" && !Array.isArray(waiver),
      `${prefix} must be an object`
    );
    for (const field of requiredFields) {
      requireString(waiver[field], `${prefix}.${field}`, { trim: field !== "passage" });
    }
    validateDate(waiver.date, `${prefix}.date`);
    if (waiver.expires !== undefined) {
      validateDate(waiver.expires, `${prefix}.expires`);
      invariant(waiver.expires >= waiver.date, `${prefix}.expires cannot precede date`);
    }
    validateCanonUrl(waiver.canon_url, `${prefix}.canon_url`);
    invariant(
      /^[0-9a-f]{64}$/.test(waiver.passage_sha256),
      `${prefix}.passage_sha256 must be 64 lowercase hex characters`
    );
    invariant(!ids.has(waiver.id), `duplicate waiver id: ${waiver.id}`);
    ids.add(waiver.id);
  }
}

async function loadWaivers() {
  const text = await readFile(waiversPath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`waivers.json is not valid JSON: ${error.message}`);
  }
}

function isExpired(waiver, now) {
  return (
    waiver.expires !== undefined &&
    Date.parse(`${waiver.expires}T23:59:59.999Z`) < now.getTime()
  );
}

async function fetchCanon(waiver) {
  const url = new URL(waiver.canon_url);
  const headers = {
    Accept: url.hostname === "api.github.com" ? "application/vnd.github+json" : "text/plain",
    "User-Agent": "rapp-map-waiver-freshness/1.0"
  };
  if (url.hostname === "api.github.com" && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    headers["X-GitHub-Api-Version"] = "2022-11-28";
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    throw new Error(`${waiver.canon_url} returned HTTP ${response.status}`);
  }
  return response.text();
}

async function checkWaiver(waiver) {
  try {
    const liveCanon = await fetchCanon(waiver);
    const actualSha256 = sha256(waiver.passage);
    return {
      id: waiver.id,
      kind: "checked",
      actualSha256,
      passagePresent: liveCanon.includes(waiver.passage),
      hashMatches: actualSha256 === waiver.passage_sha256
    };
  } catch (error) {
    return {
      id: waiver.id,
      kind: "fetch-error",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  invariant(nodeMajor >= 20, `Node >=20 is required; found ${process.versions.node}`);

  const document = await loadWaivers();
  validateWaivers(document);

  const now = new Date();
  const active = document.waivers.filter((waiver) => !isExpired(waiver, now));
  const expired = document.waivers.filter((waiver) => isExpired(waiver, now));
  const results = new Map(
    (await Promise.all(active.map(checkWaiver))).map((result) => [result.id, result])
  );

  console.log("RAPP waiver freshness");
  console.log(`waivers=${document.waivers.length} active=${active.length} expired=${expired.length}`);
  console.log();

  let staleCount = 0;
  let fetchErrorCount = 0;
  for (const waiver of document.waivers) {
    if (isExpired(waiver, now)) {
      console.log(`SKIP EXPIRED WAIVER ${waiver.id}: expired ${waiver.expires}`);
      continue;
    }

    const result = results.get(waiver.id);
    invariant(result, `missing freshness result for ${waiver.id}`);
    if (result.kind === "fetch-error") {
      fetchErrorCount += 1;
      console.error(`WAIVER ERROR ${waiver.id}: ${result.message}`);
      continue;
    }

    if (!result.passagePresent || !result.hashMatches) {
      staleCount += 1;
      console.error(`STALE WAIVER ${waiver.id}: canon moved — finding must be reopened`);
      console.error(
        `  passage_present=${result.passagePresent} passage_sha256=${result.actualSha256} pinned_sha256=${waiver.passage_sha256}`
      );
      continue;
    }

    console.log(`PASS WAIVER ${waiver.id}: canon passage is live (${result.actualSha256})`);
  }

  console.log();
  if (staleCount === 0 && fetchErrorCount === 0) {
    console.log(
      `RESULT PASS: ${active.length} active waiver pin(s) are fresh; ${expired.length} expired waiver(s) skipped.`
    );
  } else {
    console.error(
      `RESULT FAIL: ${staleCount} stale waiver(s), ${fetchErrorCount} canon fetch error(s); ${expired.length} expired waiver(s) skipped.`
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`WAIVER FRESHNESS ERROR: ${error.message}`);
  process.exitCode = 1;
});
