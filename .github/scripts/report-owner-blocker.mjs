#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const title = "rapp/1 owner action: publish authenticated section 13 registry";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(repositoryRoot, path), "utf8"));
}

function requestHeaders(token, hasBody = false) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "rapp-map-owner-blocker/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(hasBody ? { "Content-Type": "application/json" } : {})
  };
}

async function githubRequest(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: requestHeaders(token, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000)
  });
  const source = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} returned HTTP ${response.status}: ${source}`);
  }
  return source.length === 0 ? null : JSON.parse(source);
}

function issueBody(authority, blocker) {
  const tests = blocker.acceptance_tests
    .map((test) => `- [ ] \`${test.id}\`: ${test.assertion}`)
    .join("\n");
  return [
    "<!-- rapp1-owner-blocker:v1 -->",
    "## Decision required",
    "",
    blocker.why,
    "",
    `**Owner action:** ${blocker.what}`,
    "",
    "## Exact protocol authority",
    "",
    `- Repository: \`${authority.repository}\``,
    `- Commit: \`${authority.commit}\``,
    `- Spec: \`${authority.spec_path}\``,
    `- Bytes: \`${authority.bytes}\``,
    `- SHA-256: \`${authority.sha256}\``,
    "",
    "## Acceptance tests",
    "",
    tests,
    "",
    "Unknown owner inputs remain null in `RAPP1_OWNER_ACTIONS.json`. This issue is a request",
    "for an owner decision, not evidence of a signature or accepted registry."
  ].join("\n");
}

async function findOpenIssue(token, repository) {
  for (let page = 1; page <= 10; page += 1) {
    const issues = await githubRequest(
      token,
      `/repos/${repository}/issues?state=open&per_page=100&page=${page}`
    );
    invariant(Array.isArray(issues), "GitHub issues response must be an array");
    const match = issues.find((issue) => issue.title === title && !issue.pull_request);
    if (match || issues.length < 100) {
      return match ?? null;
    }
  }
  throw new Error("open issue search exceeded 1,000 records");
}

export async function reportOwnerBlocker() {
  invariant(
    process.env.RAPP1_REPORT_OWNER_BLOCKER === "true",
    "set RAPP1_REPORT_OWNER_BLOCKER=true for the explicit network/report operation"
  );
  const token = process.env.GITHUB_TOKEN;
  invariant(token, "GITHUB_TOKEN is required to report the owner blocker");
  const repository = process.env.GITHUB_REPOSITORY ?? "kody-w/rapp-map";
  invariant(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), "invalid GitHub repository");

  const [authority, ledger] = await Promise.all([
    loadJson("RAPP1_AUTHORITY.json"),
    loadJson("RAPP1_OWNER_ACTIONS.json")
  ]);
  const blocker = ledger.blockers?.find(
    (entry) => entry.id === "rapp1-section-13-authenticated-registry"
  );
  invariant(blocker?.state === "open", "owner blocker is not open");
  const body = issueBody(authority, blocker);
  const existing = await findOpenIssue(token, repository);

  if (!existing) {
    const created = await githubRequest(token, `/repos/${repository}/issues`, {
      method: "POST",
      body: { title, body }
    });
    console.log(`FILED #${created.number}: ${title}`);
    return;
  }
  if (existing.body === body) {
    console.log(`NOOP #${existing.number}: decision-ready body is already current`);
    return;
  }
  await githubRequest(token, `/repos/${repository}/issues/${existing.number}`, {
    method: "PATCH",
    body: { title, body }
  });
  console.log(`UPDATED #${existing.number}: ${title}`);
}
