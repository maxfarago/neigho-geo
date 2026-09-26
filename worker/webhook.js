import {
  dispatchImplement,
  fetchIssue,
  requestIdFromIssue,
  verifyGithubSignature,
} from "./github.js";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function ownerOk(login, env) {
  const owner = (env.OWNER_GITHUB_LOGIN || "maxfarago").toLowerCase();
  return String(login || "").toLowerCase() === owner;
}

function gameForRepo(fullName, registry) {
  return registry.games.find((g) => g.repo === fullName && g.status === "live");
}

export async function handleGithubWebhook(request, env, _ctx, registry) {
  const raw = await request.text();
  const ok = await verifyGithubSignature(
    raw,
    request.headers.get("X-Hub-Signature-256"),
    env.GITHUB_WEBHOOK_SECRET
  );
  if (!ok) return json({ error: "bad signature" }, 401);

  const event = request.headers.get("X-GitHub-Event");
  if (event === "ping") return json({ ok: true });
  if (event !== "issues") return json({ ok: true });

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (payload.action !== "labeled") return json({ ok: true });
  const label = String(payload.label?.name || "").toLowerCase();
  if (label !== "approved") return json({ ok: true });
  if (!ownerOk(payload.sender?.login, env)) return json({ ok: true });

  const repo = payload.repository?.full_name;
  const game = gameForRepo(repo, registry);
  if (!game) return json({ ok: true });

  const number = payload.issue?.number;
  if (!number) return json({ ok: true });

  await startImplement(repo, number, game, env);
  return json({ ok: true });
}

async function startImplement(repo, number, game, env) {
  let row = await env.DB.prepare(
    "select * from requests where game_id = ? and issue_number = ?"
  )
    .bind(game.id, number)
    .first();
  try {
    const issue = await fetchIssue(repo, number, env);
    const fromMarker = requestIdFromIssue(issue.body);
    if (fromMarker) {
      const marked = await env.DB.prepare("select * from requests where id = ?")
        .bind(fromMarker)
        .first();
      if (marked) row = marked;
    }
    if (!row || row.status !== "needs_review") return;

    await dispatchImplement(
      repo,
      { issue_number: number, request_id: String(row.id) },
      env
    );
    await env.DB.prepare(
      "update requests set status = 'building', error = null where id = ? and status = 'needs_review'"
    )
      .bind(row.id)
      .run();
  } catch (err) {
    if (row?.id) {
      await env.DB.prepare("update requests set status = 'error', error = ? where id = ?")
        .bind(String(err.message || err).slice(0, 300), row.id)
        .run();
    }
  }
}
