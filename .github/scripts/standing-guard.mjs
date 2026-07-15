#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const specPath = join(repositoryRoot, "ecosystem-spec.json");
const bibleUrl =
  "https://raw.githubusercontent.com/kody-w/RAPP-Bible/main/DRIFT_TRIANGLE.md";
const specHomes = [
  {
    name: "RAPP",
    url: "https://raw.githubusercontent.com/kody-w/RAPP/main/specs/ecosystem-spec.json"
  },
  {
    name: "rapp-god",
    url: "https://raw.githubusercontent.com/kody-w/rapp-god/main/api/v1/ecosystem-spec.json"
  },
  {
    name: "rapp-map",
    url: "https://raw.githubusercontent.com/kody-w/rapp-map/main/ecosystem-spec.json"
  }
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "rapp-map-standing-guard/1.0",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchBytes(url, { githubApi = false } = {}) {
  const response = await fetch(url, {
    headers: githubApi
      ? githubHeaders()
      : {
          Accept: "text/plain",
          "User-Agent": "rapp-map-standing-guard/1.0"
        },
    signal: AbortSignal.timeout(30_000)
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return { bytes, response };
}

async function loadSpec() {
  const bytes = await readFile(specPath);
  let document;
  try {
    document = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`ecosystem-spec.json is not valid JSON: ${error.message}`);
  }
  return { bytes, document };
}

async function checkTriangle() {
  const homes = await Promise.all(
    specHomes.map(async (home) => {
      const { bytes } = await fetchBytes(home.url);
      return { ...home, bytes, digest: sha256(bytes) };
    })
  );
  const reference = homes[0];

  console.log("Standing guard: drift triangle");
  let allMatch = true;
  for (const home of homes) {
    const matches =
      home.bytes.equals(reference.bytes) && home.digest === reference.digest;
    allMatch &&= matches;
    console.log(
      `${matches ? "PASS" : "FAIL"} ${home.name} bytes=${home.bytes.length} sha256=${home.digest}`
    );
  }
  invariant(allMatch, "the three ecosystem-spec homes are not byte-identical");
  console.log(
    `RESULT PASS: ${homes.length}/${homes.length} ecosystem-spec homes are byte-identical (${reference.digest}).`
  );
}

async function checkBible() {
  const [{ bytes: specBytes, document: spec }, { bytes: bibleBytes }] =
    await Promise.all([loadSpec(), fetchBytes(bibleUrl)]);
  invariant(
    typeof spec.version === "string" && spec.version.length > 0,
    "ecosystem-spec.json.version must be a non-empty string"
  );

  const bible = bibleBytes.toString("utf8");
  const digest = sha256(specBytes);
  const hasVersion = bible.includes(spec.version);
  const hasDigest = bible.includes(digest);

  console.log("Standing guard: Bible pin");
  console.log(
    `${hasVersion ? "PASS" : "FAIL"} spec version=${spec.version}`
  );
  console.log(`${hasDigest ? "PASS" : "FAIL"} spec sha256=${digest}`);
  invariant(
    hasVersion && hasDigest,
    "RAPP-Bible DRIFT_TRIANGLE.md does not contain the current spec version and SHA-256"
  );
  console.log("RESULT PASS: RAPP-Bible contains the current spec version and SHA-256.");
}

function repoNames(spec) {
  invariant(
    spec.repos !== null && typeof spec.repos === "object" && !Array.isArray(spec.repos),
    "ecosystem-spec.json.repos must be an object"
  );

  const names = [];
  for (const [group, entries] of Object.entries(spec.repos)) {
    invariant(Array.isArray(entries), `ecosystem-spec.json.repos.${group} must be an array`);
    for (const [index, entry] of entries.entries()) {
      invariant(
        typeof entry === "string" && entry.length > 0,
        `ecosystem-spec.json.repos.${group}[${index}] must be a non-empty string`
      );
      const match = /^([A-Za-z0-9_.-]+)(?:\s|$)/.exec(entry);
      invariant(match, `cannot derive a repository name from ${JSON.stringify(entry)}`);
      names.push(match[1]);
    }
  }
  return [...new Set(names)];
}

async function checkLiveness() {
  invariant(process.env.GITHUB_TOKEN, "GITHUB_TOKEN is required for repository liveness");
  const { document: spec } = await loadSpec();
  const names = repoNames(spec);
  const results = await Promise.all(
    names.map(async (name) => {
      const url = `https://api.github.com/repos/kody-w/${encodeURIComponent(name)}`;
      try {
        const { response } = await fetchBytes(url, { githubApi: true });
        return { name, status: response.status, ok: true };
      } catch (error) {
        const statusMatch = /returned HTTP (\d+)$/.exec(
          error instanceof Error ? error.message : String(error)
        );
        return {
          name,
          status: statusMatch ? Number(statusMatch[1]) : null,
          ok: false,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  console.log("Standing guard: repository liveness");
  let failures = 0;
  for (const result of results) {
    if (result.ok) {
      console.log(`PASS kody-w/${result.name} HTTP ${result.status}`);
    } else {
      failures += 1;
      console.error(
        `FAIL kody-w/${result.name} ${result.status === 404 ? "HTTP 404" : result.message}`
      );
    }
  }
  invariant(failures === 0, `${failures}/${results.length} ecosystem repositories did not resolve`);
  console.log(`RESULT PASS: ${results.length}/${results.length} ecosystem repositories resolve.`);
}

async function githubRequest(path, { method = "GET", body, allow404 = false } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      ...githubHeaders(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  if (allow404 && response.status === 404) {
    return null;
  }
  if (!response.ok) {
    let detail = text;
    try {
      detail = JSON.parse(text).message ?? text;
    } catch {
      // Preserve the response text when GitHub does not return JSON.
    }
    throw new Error(`${method} ${path} returned HTTP ${response.status}: ${detail}`);
  }
  return text.length === 0 ? null : JSON.parse(text);
}

async function ensureDriftLabel(repository) {
  const encoded = encodeURIComponent("drift");
  const existing = await githubRequest(`/repos/${repository}/labels/${encoded}`, {
    allow404: true
  });
  if (existing) {
    return;
  }
  await githubRequest(`/repos/${repository}/labels`, {
    method: "POST",
    body: {
      name: "drift",
      color: "D93F0B",
      description: "Mechanical standing-guard drift finding"
    }
  });
  console.log("CREATED label drift");
}

async function findOpenIssue(repository, title) {
  for (let page = 1; ; page += 1) {
    const issues = await githubRequest(
      `/repos/${repository}/issues?state=open&per_page=100&page=${page}`
    );
    invariant(Array.isArray(issues), "GitHub issues response must be an array");
    const match = issues.find((issue) => issue.title === title);
    if (match || issues.length < 100) {
      return match ?? null;
    }
  }
}

function failureBody(check) {
  const repository = "kody-w/rapp-map";
  const server = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const runUrl = `${server}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const commitUrl = `${server}/${repository}/commit/${process.env.GITHUB_SHA}`;
  return [
    `Mechanical standing guard check \`${check.name}\` failed.`,
    "",
    `- Run: [${process.env.GITHUB_RUN_ID}](${runUrl})`,
    `- Commit: [\`${process.env.GITHUB_SHA}\`](${commitUrl})`,
    `- Event: \`${process.env.GITHUB_EVENT_NAME}\``,
    `- Observed: \`${new Date().toISOString()}\``,
    "",
    "The linked run contains the deterministic failure output."
  ].join("\n");
}

async function reportFailures() {
  invariant(process.env.GITHUB_TOKEN, "GITHUB_TOKEN is required to report guard failures");
  const repository = "kody-w/rapp-map";
  const checks = [
    {
      name: "triangle",
      summary: "ecosystem-spec homes are not byte-identical",
      outcome: process.env.TRIANGLE_OUTCOME
    },
    {
      name: "bible",
      summary: "RAPP-Bible spec pin is stale",
      outcome: process.env.BIBLE_OUTCOME
    },
    {
      name: "conformance",
      summary: "golden conformance disagrees with expected verdicts",
      outcome: process.env.CONFORMANCE_OUTCOME
    },
    {
      name: "waiver-freshness",
      summary: "active waiver canon pin is stale",
      outcome: process.env.WAIVER_FRESHNESS_OUTCOME
    },
    {
      name: "liveness",
      summary: "an ecosystem repository does not resolve",
      outcome: process.env.LIVENESS_OUTCOME
    }
  ];
  const failures = checks.filter((check) => check.outcome !== "success");
  invariant(failures.length > 0, "report requested without a failed guard check");

  await ensureDriftLabel(repository);
  for (const check of failures) {
    const title = `drift(guard-${check.name}): ${check.summary}`;
    const body = failureBody(check);
    const existing = await findOpenIssue(repository, title);
    if (existing) {
      const hasDriftLabel = existing.labels?.some((label) =>
        typeof label === "string" ? label === "drift" : label.name === "drift"
      );
      if (!hasDriftLabel) {
        await githubRequest(`/repos/${repository}/issues/${existing.number}/labels`, {
          method: "POST",
          body: { labels: ["drift"] }
        });
      }
      await githubRequest(`/repos/${repository}/issues/${existing.number}/comments`, {
        method: "POST",
        body: { body }
      });
      console.log(`COMMENTED #${existing.number} ${title}`);
    } else {
      const created = await githubRequest(`/repos/${repository}/issues`, {
        method: "POST",
        body: { title, body, labels: ["drift"] }
      });
      console.log(`FILED #${created.number} ${title}`);
    }
  }

  console.error(`RESULT FAIL: ${failures.length} standing-guard check(s) failed.`);
  process.exitCode = 1;
}

const commands = {
  triangle: checkTriangle,
  bible: checkBible,
  liveness: checkLiveness,
  report: reportFailures
};

async function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  invariant(nodeMajor >= 20, `Node >=20 is required; found ${process.versions.node}`);
  const command = process.argv[2];
  invariant(
    Object.hasOwn(commands, command),
    `usage: node .github/scripts/standing-guard.mjs <${Object.keys(commands).join("|")}>`
  );
  await commands[command]();
}

main().catch((error) => {
  console.error(`STANDING GUARD ERROR [${process.argv[2] ?? "unknown"}]: ${error.message}`);
  process.exitCode = 1;
});
