# AGENTS.md

Arcade cabinet at max.horse. Not a game. Not a monorepo.

## What it is

neigho-geo is the game-select shell. Apex is already this project. Play navigates to a game host. Suggest is shelf-only.

Agents that implement player requests clone the **game** repo (`master`), never this one.

Live carts:

- Umatamari — https://umatamari.max.horse — `maxfarago/umatamari`
- Unbridled — https://unbridled.max.horse — `maxfarago/unbridled`

Suggest: `POST /api/requests` → Haiku screen (no code) → Haiku spec with a GitHub snapshot of the game repo (`master` tree + a few files) → GitHub issue only if the spec has a `#` title and `## Acceptance` with ≥2 bullets. Thin or malformed specs are retried once, then `error` with no issue. Owner implements on the game repo.

## Layout

```
index.html
src/main.js           still grid, overlay, keyboard
src/style.css
src/registry.json     games, play urls, repos, stills, suggest presets
src/request-modal.js  <mh-request-modal>
worker/index.js       POST /api/requests → D1, screen, spec, issue
worker/screen.js      Haiku suitability (no repo)
worker/spec.js        Haiku spec; shape gate; issue
worker/github.js      repo snapshot, issue create
migrations/           D1 schema
public/stills/        square title stills
```

Adding a cart is a registry row. No platform logic for a new game.

## Rules

- No three.js. No Clerk on first paint. Shell JS stays static; the API is a Worker.
- No SNK logos, names, fonts, or audio. Homage only.
- Playing never requires an account.
- Do not iframe games.
- Game default branch is always `master`.
- Owner exclusively commits, pushes, and deploys. Do not commit, push, open PRs, or deploy.
- Do not change `max.horse` DNS.

## Run

```
npm i && npm run db:migrate && npm run dev
```
