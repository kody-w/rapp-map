#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const blockerId = "rapp1-section-13-authenticated-registry";
export const ISSUE_MARKER =
  "<!-- rapp1-owner-blocker:3c5b3c0c5eb3512bc037954a8c0ceb1d7c1ecd4b82641ef303ec9cf483b0d82e -->";
export const DEFAULT_TITLE = "rapp/1 owner action: publish authenticated section 13 registry";

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
    "User-Agent": "rapp-map-owner-blocker/2.0",
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

export function issueBody(authority, blocker) {
  const tests = blocker.acceptance_tests
    .map((test) => `- [ ] \`${test.id}\`: ${test.assertion}`)
    .join("\n");
  return [
    ISSUE_MARKER,
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

export function selectManagedIssue(issues) {
  invariant(Array.isArray(issues), "GitHub issues response must be an array");
  const issueRecords = issues.filter((issue) => !issue.pull_request);
  const marked = issueRecords.filter(
    (issue) => typeof issue.body === "string" && issue.body.includes(ISSUE_MARKER)
  );
  invariant(marked.length <= 1, `refusing ${marked.length} issues with the managed marker`);
  const titleCollisions = issueRecords.filter(
    (issue) => issue.title === DEFAULT_TITLE && !marked.includes(issue)
  );
  invariant(
    titleCollisions.length === 0,
    `refusing unmarked title collision on issue #${titleCollisions[0]?.number ?? "unknown"}`
  );
  invariant(
    !marked[0] || marked[0].state === "open",
    `managed issue #${marked[0]?.number ?? "unknown"} is closed; refusing to reopen or duplicate it`
  );
  return marked[0] ?? null;
}

async function listIssues(request, token, repository) {
  const issues = [];
  for (let page = 1; page <= 10; page += 1) {
    const pageIssues = await request(
      token,
      `/repos/${repository}/issues?state=all&per_page=100&page=${page}`
    );
    invariant(Array.isArray(pageIssues), "GitHub issues response must be an array");
    issues.push(...pageIssues);
    if (pageIssues.length < 100) {
      return issues;
    }
  }
  throw new Error("issue search exceeded 1,000 records");
}

export async function reportOwnerBlocker({
  request = githubRequest,
  environment = process.env,
  log = console.log,
  load = loadJson
} = {}) {
  invariant(
    environment.RAPP1_REPORT_OWNER_BLOCKER === "true",
    "set RAPP1_REPORT_OWNER_BLOCKER=true for the explicit network/report operation"
  );
  const token = environment.GITHUB_TOKEN;
  invariant(token, "GITHUB_TOKEN is required to report the owner blocker");
  const repository = environment.GITHUB_REPOSITORY ?? "kody-w/rapp-map";
  invariant(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), "invalid GitHub repository");

  const [authority, ledger] = await Promise.all([
    load("RAPP1_AUTHORITY.json"),
    load("RAPP1_OWNER_ACTIONS.json")
  ]);
  const blocker = ledger.blockers?.find((entry) => entry.id === blockerId);
  invariant(blocker?.state === "open" || blocker?.state === "closed", "owner blocker state must be open or closed");
  const issues = await listIssues(request, token, repository);
  if (blocker.state === "closed") {
    // The owner decided. Close the managed request if it is still open; never file a new one.
    const openManaged = issues.filter(
      (issue) => !issue.pull_request && typeof issue.body === "string" && issue.body.includes(ISSUE_MARKER) && issue.state === "open"
    );
    invariant(openManaged.length <= 1, `refusing ${openManaged.length} open issues with the managed marker`);
    if (openManaged.length === 0) {
      log("NOOP: owner blocker closed; no open managed issue");
      return { action: "noop", number: null };
    }
    const number = openManaged[0].number;
    await request(token, `/repos/${repository}/issues/${number}/comments`, {
      method: "POST",
      body: { body: `Owner decision recorded ${blocker.when?.published_at ?? ""}: registry published at ${blocker.where?.owner_publication_location ?? "(see ledger)"}. Closing.` }
    });
    await request(token, `/repos/${repository}/issues/${number}`, { method: "PATCH", body: { state: "closed" } });
    log(`CLOSED #${number}: owner blocker resolved`);
    return { action: "closed", number };
  }
  const body = issueBody(authority, blocker);
  const existing = selectManagedIssue(issues);

  if (!existing) {
    const created = await request(token, `/repos/${repository}/issues`, {
      method: "POST",
      body: { title: DEFAULT_TITLE, body }
    });
    log(`FILED #${created.number}: ${DEFAULT_TITLE}`);
    return { action: "filed", number: created.number };
  }
  if (existing.body === body) {
    log(`NOOP #${existing.number}: marker-bound body is already current`);
    return { action: "noop", number: existing.number };
  }
  await request(token, `/repos/${repository}/issues/${existing.number}`, {
    method: "PATCH",
    body: { body }
  });
  log(`UPDATED #${existing.number}: marker-bound owner decision`);
  return { action: "updated", number: existing.number };
}
