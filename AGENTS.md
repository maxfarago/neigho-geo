# AGENTS.md

Arcade cabinet for max.horse. Not a game. Not a monorepo.

## What it is

neigho-geo is the game-select shell at max.horse. Play navigates to a game host. Suggest is shelf-only. Agents that implement player requests clone the **game** repo, never this one.

Live carts:

- Umatamari — https://umatamari.max.horse — `maxfarago/umatamari`
- Unbridled — https://unbridled.max.horse — `maxfarago/unbridled`

`max-horse-platform-plan.md` is stale (monorepo, in-repo games, JSON prop recipes). Ignore it.

## Layout

```
index.html
src/main.js           splash, shelf, attract, input
src/style.css
src/registry.json     carts, play urls, suggest presets
src/request-modal.js  <mh-request-modal>; submit disabled until requests ship
```

Adding a cart is a registry row. No platform logic for a new game.

## Rules

- No three.js. No Clerk on first paint. Shell stays a static Vite page.
- No SNK logos, names, fonts, or audio. Homage only.
- Playing never requires an account.
- Do not iframe games.
- Owner exclusively commits and pushes. Do not commit, push, open PRs, or deploy.
- `umatamari.max.horse` DNS may not exist yet. Do not point the apex at this project until that host serves the game.

## Run

```
npm i && npm run dev
```
