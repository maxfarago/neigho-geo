import registry from "../src/registry.json";
import { screenRequest } from "./screen.js";
import { writeSpec } from "./spec.js";

const MIN = 20;
const MAX = 800;
const RATE = 3;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function liveGame(id) {
  return registry.games.find((g) => g.id === id && g.status === "live");
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "local"
  );
}

async function fail(id, env, msg) {
  await env.DB.prepare("update requests set status = 'error', error = ? where id = ?")
    .bind(String(msg).slice(0, 300), id)
    .run();
}

async function processRequest(id, env) {
  const row = await env.DB.prepare("select * from requests where id = ?").bind(id).first();
  if (!row || row.status !== "submitted") return;
  const game = liveGame(row.game_id);
  if (!game) {
    await fail(id, env, "unknown game");
    return;
  }

  try {
    await env.DB.prepare("update requests set status = 'screening' where id = ?")
      .bind(id)
      .run();

    const { verdict, reason } = await screenRequest(row, game, env);
    if (verdict !== "accept") {
      await env.DB.prepare(
        "update requests set status = 'declined', decline_reason = ? where id = ?"
      )
        .bind(reason, id)
        .run();
      return;
    }

    await env.DB.prepare("update requests set status = 'speccing' where id = ?").bind(id).run();
    await writeSpec(row, game, env);
  } catch (err) {
    await fail(id, env, err.message || err);
  }
}

async function createRequest(request, env, ctx) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const gameId = String(payload.gameId ?? "");
  const presetId = String(payload.presetId ?? "");
  const body = String(payload.body ?? "").trim();
  const credit = payload.credit === false ? 0 : 1;

  const game = liveGame(gameId);
  if (!game) return json({ error: "unknown game" }, 400);
  if (!game.presets.some((p) => p.id === presetId)) {
    return json({ error: "unknown preset" }, 400);
  }
  if (body.length < MIN || body.length > MAX) {
    return json({ error: "body length" }, 400);
  }

  const ip = clientIp(request);
  const counted = await env.DB.prepare(
    `select count(*) as n from requests
     where ip = ? and created_at > datetime('now', '-24 hours')`
  )
    .bind(ip)
    .first();
  if ((counted?.n ?? 0) >= RATE) return json({ error: "rate limit" }, 429);

  const result = await env.DB.prepare(
    `insert into requests (game_id, preset_id, body, credit, status, ip)
     values (?, ?, ?, ?, 'submitted', ?)`
  )
    .bind(gameId, presetId, body, credit, ip)
    .run();

  const id = Number(result.meta.last_row_id);
  ctx.waitUntil(processRequest(id, env));
  return json({ id }, 201);
}

async function getRequest(id, env) {
  const row = await env.DB.prepare(
    `select id, game_id, preset_id, status, decline_reason, issue_url, issue_number
     from requests where id = ?`
  )
    .bind(id)
    .first();
  if (!row) return json({ error: "not found" }, 404);
  return json(row);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/api/requests") {
        return await createRequest(request, env, ctx);
      }
      const get = url.pathname.match(/^\/api\/requests\/(\d+)$/);
      if (request.method === "GET" && get) {
        return await getRequest(Number(get[1]), env);
      }
    } catch {
      return json({ error: "server" }, 500);
    }
    return new Response(null, { status: 404 });
  },
};
