#!/usr/bin/env node
/**
 * Touches-bounded implementer. Runs on the game repo (Actions).
 * Env: ANTHROPIC_API_KEY, GITHUB_TOKEN, GH_REPO, ISSUE_NUMBER, REQUEST_ID?
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const MODEL = "claude-haiku-4-5-20251001";
const ROOT = process.cwd();
const ISSUE = Number(process.env.ISSUE_NUMBER);
const REPO = process.env.GH_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const KEY = process.env.ANTHROPIC_API_KEY;
const REQUEST_ID = process.env.REQUEST_ID || "";

if (!ISSUE || !REPO || !TOKEN || !KEY) {
  console.error("missing ISSUE_NUMBER, GH_REPO, GITHUB_TOKEN, or ANTHROPIC_API_KEY");
  process.exit(1);
}

function gh(path) {
  const res = fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "neigho-geo-implement",
    },
  });
  return res;
}

function extractTouches(spec) {
  const parts = String(spec).split(/^## Touches\s*$/im);
  if (parts.length < 2) return [];
  const section = parts[1].split(/^## /m)[0];
  const out = [];
  for (const line of section.split("\n")) {
    const ticks = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const bare = line.match(/^\s*[-*]\s+(\S+\.\w[\w./-]*)/);
    const cands = ticks.length ? ticks : bare ? [bare[1]] : [];
    for (let p of cands) {
      p = p.replace(/^[./]+/, "");
      if (!p || p.includes("..") || p.startsWith("/")) continue;
      if (/(^|\/)(node_modules|dist|\.git)\//.test(p)) continue;
      out.push(p);
    }
  }
  return [...new Set(out)].slice(0, 12);
}

function safePath(p) {
  const abs = resolve(ROOT, p);
  const rel = relative(ROOT, abs);
  if (rel.startsWith("..") || normalize(rel) !== rel) return null;
  return rel;
}

function testCommand() {
  if (!existsSync("package.json")) return null;
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (pkg.scripts?.test) return ["npm", ["test"]];
  if (pkg.scripts?.build) return ["npm", ["run", "build"]];
  return null;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 2_000_000,
    env: process.env,
    ...opts,
  });
  return {
    ok: r.status === 0,
    out: `${r.stdout || ""}${r.stderr || ""}`.slice(-8000),
    status: r.status,
  };
}

function extractJson(text) {
  const t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : t;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1));
}

async function draft(spec, files, extra) {
  const listing = files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Implement this spec. You may ONLY change the listed files. Do not invent paths.

Return JSON only:
{"files":[{"path":"relative/path","content":"full new file contents"}]}

${extra || ""}

Spec:
<spec>
${spec}
</spec>

Current files:
<files>
${listing}
</files>`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`anthropic ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return extractJson(text);
}

function apply(allowed, payload) {
  const wrote = [];
  for (const f of payload.files || []) {
    const rel = safePath(String(f.path || ""));
    if (!rel || !allowed.has(rel)) continue;
    const abs = join(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, String(f.content ?? ""), "utf8");
    wrote.push(rel);
  }
  return wrote;
}

const issueRes = await gh(`/repos/${REPO}/issues/${ISSUE}`);
if (!issueRes.ok) throw new Error(`issue ${issueRes.status}`);
const issue = await issueRes.json();
const spec = String(issue.body || "");
const touches = extractTouches(spec)
  .map(safePath)
  .filter(Boolean)
  .filter((p) => existsSync(join(ROOT, p)));
if (!touches.length) throw new Error("no valid ## Touches files in the worktree");

const allowed = new Set(touches);
const files = touches.map((path) => ({
  path,
  content: readFileSync(join(ROOT, path), "utf8").slice(0, 80_000),
}));

let payload = await draft(spec, files, "");
let wrote = apply(allowed, payload);
if (!wrote.length) {
  payload = await draft(spec, files, "Your last reply was not valid JSON with files[]. Try again.\n");
  wrote = apply(allowed, payload);
}
if (!wrote.length) throw new Error("model wrote no allowed files");

if (existsSync("package.json")) run("npm", ["i", "--no-audit", "--no-fund"]);
const test = testCommand();
if (test) {
  let result = run(test[0], test[1]);
  if (!result.ok) {
    const current = wrote.map((path) => ({
      path,
      content: readFileSync(join(ROOT, path), "utf8").slice(0, 80_000),
    }));
    payload = await draft(
      spec,
      current,
      `The test command failed. Fix only these files. Log:\n${result.out}\n`
    );
    wrote = [...new Set([...wrote, ...apply(allowed, payload)])];
    result = run(test[0], test[1]);
    if (!result.ok) console.log("tests still failing; opening PR anyway\n", result.out);
  }
}

const branch = `mh/issue-${ISSUE}`;
execFileSync("git", ["config", "user.name", "neigho-geo factory"], { stdio: "inherit" });
execFileSync("git", ["config", "user.email", "factory@max.horse"], { stdio: "inherit" });
execFileSync("git", ["checkout", "-B", branch], { stdio: "inherit" });
execFileSync("git", ["add", "--", ...wrote], { stdio: "inherit" });
const staged = run("git", ["diff", "--cached", "--quiet"]);
if (staged.ok) throw new Error("no file changes");
execFileSync("git", ["commit", "-m", `feat: implement #${ISSUE}`], { stdio: "inherit" });
execFileSync("git", ["push", "-u", "origin", branch, "--force-with-lease"], { stdio: "inherit" });

const title = (issue.title || `implement #${ISSUE}`).slice(0, 200);
const marker = REQUEST_ID ? `\n<!-- mh:request:${REQUEST_ID} -->\n` : "";
const prRes = await fetch(`https://api.github.com/repos/${REPO}/pulls`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "neigho-geo-implement",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title,
    head: branch,
    base: "master",
    body: `Implements #${ISSUE}. Bound to spec \`## Touches\`. One local test retry, then this PR sits.\n${marker}`,
  }),
});
if (!prRes.ok) {
  const t = await prRes.text();
  throw new Error(`pr ${prRes.status}: ${t.slice(0, 200)}`);
}
const pr = await prRes.json();
console.log(pr.html_url);
