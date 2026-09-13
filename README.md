# Greenhouse Home — Obsidian plugin

Shawn's Greenhouse life dashboard as the vault home view: bench (today · grew
overnight · waiting on you) above sixteen pillar beds in four fixed tiers,
styled to match your Obsidian theme (live, light and dark) or the original greenhouse-by-day /
woodshop-by-night skins. Fed by
`AGENTS/dashboard/feed.json`, compiled nightly on the NAS and fetched fresh
from the bridge (`<bridgeUrl>/greenhouse/feed.json`), cached back into the vault.

Works on desktop **and mobile** (`isDesktopOnly: false`, HTTP via `requestUrl`).

## Install (BRAT)

Settings → BRAT → *Add beta plugin* → `srconard/obsidian-greenhouse-home` →
enable **Greenhouse Home** under Community plugins. BRAT installs from the
release assets (`main.js`, `manifest.json`, `styles.css`) and keeps it updated.

## Controls

- `⌂ home` / `☑ tasks` — bed grid vs. the tasks lens
- `A−` / `A+` — text size (multiplies Obsidian's own font size; saved per device)
- `⚙` — theme: **Match Obsidian** (default; follows the active theme and its light/dark half live) or
  **Greenhouse** (the original day/night skin, switched by the clock). Also under Settings → Greenhouse Home.
- keyboard: `g` home · `t` tasks · `1–9,0` open the ten non-fallow rooms
- ↻ header action — refresh from the NAS

## Development

```
npm install
npm run dev          # esbuild watch → ./main.js
npm run dev:vault    # build straight into the vault plugin folder (desktop iteration)
npm run check        # tsc
npm run build        # production main.js
```

Release: bump `version` in `manifest.json` + `package.json` (+ `versions.json`),
commit, tag `vX.Y.Z`, push the tag → CI builds and attaches the three assets.
A release with no assets silently breaks BRAT — CI refuses to cut one.

Design of record lives in the vault: `AGENTS/dev/greenhouse/`.
