function headers(env) {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("missing GITHUB_TOKEN");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "neigho-geo",
  };
}

function decodeBase64(s) {
  const bin = atob(String(s).replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function skipPath(p) {
  return (
    /(^|\/)(node_modules|dist|\.git|\.wrangler|vendor)\//.test(p) ||
    /\.(png|jpe?g|gif|webp|ico|woff2?|mp3|wav|ogg|glb|bin|lock|map)$/i.test(p)
  );
}

export async function repoContext(repo, env) {
  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/master?recursive=1`,
    { headers: headers(env) }
  );
  if (!treeRes.ok) {
    const t = await treeRes.text();
    throw new Error(`github tree ${treeRes.status}: ${t.slice(0, 200)}`);
  }
  const tree = await treeRes.json();
  const paths = (tree.tree || [])
    .filter((n) => n.type === "blob" && n.path && !skipPath(n.path))
    .map((n) => n.path);

  const listing = paths.slice(0, 250).join("\n");
  const always = ["AGENTS.md", "README.md", "package.json"].filter((p) => paths.includes(p));
  const source = paths.filter((p) => /\.(js|mjs|ts|tsx|jsx|css|md)$/i.test(p) && !always.includes(p));
  source.sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length);
  const want = [...always, ...source].slice(0, 12);

  const files = [];
  let used = 0;
  const budget = 48_000;
  for (const path of want) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=master`,
      { headers: headers(env) }
    );
    if (!res.ok) continue;
    const data = await res.json();
    if (data.type !== "file" || !data.content) continue;
    let text = decodeBase64(data.content).slice(0, 8_000);
    if (used + text.length > budget) text = text.slice(0, Math.max(0, budget - used));
    if (!text) break;
    files.push(`--- ${path} ---\n${text}`);
    used += text.length;
    if (used >= budget) break;
  }

  return `File tree (master, truncated):\n${listing}\n\nSelected files:\n${files.join("\n\n")}`;
}

export async function createIssue(repo, title, body, env) {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: { ...headers(env), "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.slice(0, 200), body }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`github ${res.status}: ${t.slice(0, 200)}`);
  }

  const issue = await res.json();
  return { url: issue.html_url, number: issue.number };
}
