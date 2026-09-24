# neigho-geo

an arcade platform at [max.horse](https://max.horse) inspired by NEO•GEO cabinets from the 90s, with a twist: games are crowd-built with the help of agents.

players can suggest features that get automatically screened, rewritten as specs, and turned into github issues in the game's repo, awaiting [human](https://en.wikipedia.org/wiki/Human) approval. if approved, the feature is implemented and a playable build is exposed for testing before shipping.

## overview

#### current games:

games are added in `src/registry.json`: play url, repo, still, and feature-suggest presets. no platform code is in this repo.

- [Umatamari](https://umatamari.max.horse) — [`maxfarago/umatamari`](https://github.com/maxfarago/umatamari)
- [Unbridled](https://unbridled.max.horse) — [`maxfarago/unbridled`](https://github.com/maxfarago/unbridled)

#### user-requested feature flow:

1. a player submits a feature (20–800 chars)
2. an agent screens it (jailbreak, nsfw, etc.) - rejects never touch gh
3. if it passes, a new agent reads the game’s `master` for context writes a spec
4. a loop opens a gh issue iff the spec meets requirements; thin or incomplete specs get a single retry
5. if approved, an agent branches off `master` and implements the spec
6. a public branch build is automatically generated for playtesting

## agents

rules for agents live in [`AGENTS.md`](AGENTS.md). game default branch is always `master`.
