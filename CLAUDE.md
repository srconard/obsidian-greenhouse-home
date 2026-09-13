# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Greenhouse Home — Obsidian plugin. Renders Shawn's Greenhouse life dashboard (bench + 16 pillar beds in 4 fixed tiers, greenhouse-by-day / woodshop-by-night skins) as a native view that opens on startup, on PC and mobile.

**Feed contract:** reads the vault file `AGENTS/dashboard/feed.json`, fetched fresh from the NAS bridge `GET <bridgeUrl>/greenhouse/feed.json` and cached back to the vault; falls back to the cached copy (with an "as of" stamp) when the bridge is unreachable. Items carry `text` (raw), optional `short` (AI-curated line), and `source` (vault-relative path — the click-through target). Display caps: bench 60 · alive 72 · task 90 chars.

**Design of record:** `AGENTS/dev/greenhouse/greenhouse-v1-design.md` (spec) and `AGENTS/dev/greenhouse/plans/2026-07-09-greenhouse-v1-plan.md` (implementation plan).

## Source of truth (2026-08-24)

- **Canonical source: `C:\dev\obsidian-greenhouse-home`** (this repo). The vault folder `.obsidian/plugins/greenhouse-home/` is the *install target* — BRAT's territory once the BRAT install lands; never treat it as the dev environment.
- Ship: bump `version` in `manifest.json` + `package.json` (+ `versions.json`) → commit → tag `vX.Y.Z` → push tag → CI (`.github/workflows/release.yml`) attaches `main.js`/`manifest.json`/`styles.css` → BRAT updates PC **and phone**. A release with no assets silently breaks BRAT; CI refuses to cut one.
- Desktop iteration: `npm run dev:vault` builds straight into the vault folder. **`obsidian plugin:reload` does NOT swap code or the manifest** (verified 2026-08-24 — still reported 1.0.0). Use `app.plugins.disablePlugin(id)` → `app.plugins.loadManifests()` → `app.plugins.enablePlugin(id)` via `obsidian eval`, then verify pixels.
- Theme (v1.2.0, 2026-09-13): `settings.theme` = `obsidian` (default) | `greenhouse`, chosen from the `⚙` menu in the view header or the settings tab; `applyTheme()` swaps the `gh-obsidian` / `gh-day` / `gh-night` class on `contentEl`. **`.gh-obsidian` rules may use only live Obsidian variables** (`--background-primary/secondary`, `--background-modifier-border`, `--text-normal/muted/accent`, `--interactive-accent`, `--font-text`) — that is what makes it follow the active theme and light/dark with no JS. Hard-coded colours belong only to the greenhouse skins.
- Text sizing: every size is `calc(var(--font-text-size,16px) * var(--gh-scale,1)) × k` — Obsidian's Appearance → Font size scales the view on every device; `A−`/`A+` (and the *Text size* slider) multiply on top via `settings.fontScale` (0.7–2.0, saved per device).

## Development Setup

- **Build:** `npm run build` (esbuild → `main.js`)
- **Dev mode:** `npm run dev` (watch)
- **Typecheck:** `npm run check`
- **Dev loop:** the obsidian-cli skill (reload plugin, run-js, capture errors, screenshot)

## Key Files

- `main.ts` — plugin entry: view registration, command, `obsidian://greenhouse` protocol handler, open-on-startup
- `view.ts` — the `greenhouse-home` ItemView (render, keyboard layer `g`/`t`/digits)
- `feed.ts` — fetch-from-bridge + vault-cache fallback
- `settings.ts` — open-on-startup toggle, bridge URL, fetch timeout
- `types.ts` — Feed/Pillar/FeedItem shapes (mirror of compile_feed.py output)
- `styles.css` — ported v0 skins, scoped under `.greenhouse-view`, `gh-day`/`gh-night`

## Obsidian Plugin Development Notes

- Plugin must export a default class extending `Plugin` from 'obsidian'
- Use `this.app` to access the Obsidian API
- Register commands with `this.addCommand()`
- Add settings with `this.addSettingTab()`
- Clean up resources in `onunload()`
- Use `requestUrl` (not fetch) for HTTP — avoids CORS issues and works on mobile

### Hard-learned rules (2026-07-10 blank-view incident)

- **Never define a view method named `open`, `close`, `load`, `unload`, `onload`, `onunload`, `setState`, `getState`, `getEphemeralState`, `setEphemeralState`, or `onResize`** — TypeScript `private` is erased at runtime, so any same-named method shadows the base `View`/`Component` lifecycle. Shadowing `open(containerEl)` silently kills every mount: Obsidian catches the throw (`console.error("Failed to open view")`), the promise resolves, and the leaf stays a blank pane forever. That exact bug shipped in v1 as `private open(path)` (now `openSource`).
- **Collision audit** (run after adding methods) — in the obsidian CLI:
  `var proto=Object.getPrototypeOf(app.workspace.getLeavesOfType('greenhouse-home')[0].view); var base={}; var p=Object.getPrototypeOf(proto); while(p&&p!==Object.prototype){Object.getOwnPropertyNames(p).forEach(n=>base[n]=1);p=Object.getPrototypeOf(p);} Object.getOwnPropertyNames(proto).filter(n=>base[n]&&!{constructor:1,onOpen:1,getViewType:1,getDisplayText:1,getIcon:1}[n])` → must be `[]`.
- **Verification must prove pixels, not DOM**: innerHTML length, dispatched KeyboardEvents, and tabIndex all succeed on a *detached* element. Every view verification must assert `view.containerEl.isConnected === true`, `view.containerEl.parentElement === leaf.containerEl`, and `view.contentEl.offsetHeight > 0`.
