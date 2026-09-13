import { ItemView, Menu, WorkspaceLeaf } from "obsidian";
import type GreenhousePlugin from "./main";
import type { GreenhouseTheme } from "./settings";
import type { Feed, FeedItem, Pillar } from "./types";
import { loadFeed } from "./feed";

export const VIEW_TYPE = "greenhouse-home";

const CAPS = { bench: 60, alive: 72, task: 90 } as const;
const TIERS: [string, string, string][] = [
	["core", "CORE — NON-NEGOTIABLE", "gh-g3"],
	["secondary", "SECONDARY", "gh-g4"],
	["other", "OTHER", "gh-g3"],
	["fallow", "FALLOW — RESTING, NOT FORGOTTEN", "gh-g6"],
];

export function clamp(s: string, cap: number): string {
	const t = (s || "").trim();
	return t.length <= cap ? t : t.slice(0, cap - 1).trimEnd() + "…";
}
export function display(i: { text: string; short?: string }, cap: number): string {
	return i.short || clamp(i.text, cap);
}

export class GreenhouseView extends ItemView {
	plugin: GreenhousePlugin;
	private mode: "home" | "tasks" = "home";
	private feed: Feed | null = null;
	private fresh = false;

	constructor(leaf: WorkspaceLeaf, plugin: GreenhousePlugin) {
		super(leaf);
		this.plugin = plugin;
		// keyboard layer lives in the constructor, not onOpen: the startup
		// onOpen call can abort mid-run (observed live), the constructor cannot
		this.contentEl.tabIndex = 0;
		this.registerDomEvent(this.contentEl, "keydown", (ev: KeyboardEvent) => this.handleKey(ev));
	}

	private handleKey(ev: KeyboardEvent): void {
		if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
		if (ev.key === "g") { this.mode = "home"; this.render(); }
		else if (ev.key === "t") { this.mode = "tasks"; this.render(); }
		else if (/^[0-9]$/.test(ev.key) && this.feed) {
			// tier order (matches displayed bed order), not pillar-map file order
			const order: string[] = [];
			for (const [tier] of TIERS) {
				if (tier === "fallow") continue;
				for (const p of this.feed.pillars) if (p.tier === tier) order.push(p.id);
			}
			const idx = ev.key === "0" ? 9 : Number(ev.key) - 1;
			const id = order[idx];
			if (!id) return;
			this.mode = "home"; this.render();
			const bed = this.contentEl.querySelector<HTMLDetailsElement>(`details[data-pillar="${id}"]`);
			if (bed) { bed.open = true; bed.scrollIntoView({ block: "center" }); }
		}
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return "Greenhouse"; }
	getIcon(): string { return "sprout"; }

	async onOpen(): Promise<void> {
		this.addAction("refresh-cw", "Refresh from NAS", () => this.reload(true));
		// immediate placeholder: startup main-thread congestion can delay the
		// first load by tens of seconds — never show a blank home
		this.contentEl.createDiv({ text: "🌿 greenhouse loading…" });
		await this.reload(true);
	}

	hasFeed(): boolean { return this.feed !== null; }

	async reload(forceFetch: boolean): Promise<void> {
		try {
			const { feed, fresh, error } = await loadFeed(this.app, this.plugin.settings, forceFetch);
			this.feed = feed; this.fresh = fresh;
			this.render(error);
		} catch (e) {
			this.feed = null;
			this.render(String(e));
		}
	}

	// NEVER name this "open" — TS `private` doesn't exist at runtime, and a
	// method named `open` shadows View.prototype.open(containerEl), the
	// lifecycle call that mounts the view. Shadowing it = permanent blank leaf
	// (Obsidian swallows the throw into console.error "Failed to open view").
	private openSource(path: string): void {
		const link = path.endsWith(".md") ? path.slice(0, -3) : path;
		this.app.workspace.openLinkText(link, "", false);
	}

	// theme: "obsidian" styles from live Obsidian variables (follows theme + light/dark instantly, no JS);
	// "greenhouse" is the original skin, day or night by the clock at render time
	applyTheme(): void {
		const root = this.contentEl;
		root.removeClass("gh-day", "gh-night", "gh-obsidian");
		if (this.plugin.settings.theme === "greenhouse") {
			const h = new Date().getHours();
			root.addClass(h >= 6 && h < 18 ? "gh-day" : "gh-night");
		} else {
			root.addClass("gh-obsidian");
		}
	}

	private openThemeMenu(ev: MouseEvent): void {
		const current = this.plugin.settings.theme;
		const pick = async (theme: GreenhouseTheme) => {
			this.plugin.settings.theme = theme;
			await this.plugin.saveSettings();
			this.applyTheme();
		};
		const menu = new Menu();
		menu.addItem(i => i.setTitle("Match Obsidian").setIcon("palette")
			.setChecked(current === "obsidian").onClick(() => pick("obsidian")));
		menu.addItem(i => i.setTitle("Greenhouse (day · night)").setIcon("sprout")
			.setChecked(current === "greenhouse").onClick(() => pick("greenhouse")));
		menu.showAtMouseEvent(ev);
	}

	// text scale: multiplies Obsidian's own font size; persisted in plugin settings (per device)
	private async bumpScale(d: number): Promise<void> {
		const s = this.plugin.settings;
		s.fontScale = Math.round(Math.min(2.0, Math.max(0.7, (s.fontScale || 1) + d)) * 10) / 10;
		this.contentEl.style.setProperty("--gh-scale", String(s.fontScale));
		await this.plugin.saveSettings();
	}

	private item(parent: HTMLElement, i: FeedItem, cap: number): void {
		const el = parent.createSpan({ cls: "gh-link", text: display(i, cap) });
		el.title = i.text;
		el.onClickEvent(() => this.openSource(i.source));
	}

	private render(error?: string): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("greenhouse-view");
		root.style.setProperty("--gh-scale", String(this.plugin.settings.fontScale || 1));
		this.applyTheme();

		const wrap = root.createDiv({ cls: "gh-wrap" });
		if (!this.feed) {
			wrap.createDiv({ text: "greenhouse not compiled yet — say “regenerate the greenhouse”." });
			if (error) wrap.createDiv({ cls: "gh-stale", text: error });
			return;
		}
		const feed = this.feed;

		const head = wrap.createDiv({ cls: "gh-head" });
		head.createSpan({ cls: "gh-title", text: `🌿 Greenhouse — ${feed.date}` });
		const nav = head.createSpan({ cls: "gh-nav" });
		const navHome = nav.createSpan({ text: "⌂ home", cls: this.mode === "home" ? "on" : "" });
		const navTasks = nav.createSpan({ text: "☑ tasks", cls: this.mode === "tasks" ? "on" : "" });
		navHome.onClickEvent(() => { this.mode = "home"; this.render(); });
		navTasks.onClickEvent(() => { this.mode = "tasks"; this.render(); });
		const fsMinus = nav.createSpan({ text: "A−", cls: "gh-fs", title: "smaller text" });
		const fsPlus = nav.createSpan({ text: "A+", cls: "gh-fs", title: "bigger text" });
		fsMinus.onClickEvent(() => this.bumpScale(-0.1));
		fsPlus.onClickEvent(() => this.bumpScale(0.1));
		const gear = nav.createSpan({ text: "⚙", cls: "gh-fs gh-gear", title: "greenhouse settings" });
		gear.onClickEvent((ev) => this.openThemeMenu(ev));

		if (!this.fresh) wrap.createDiv({ cls: "gh-stale", text: `⚠ offline copy — as of ${feed.generated_at}` });

		const bench = wrap.createDiv({ cls: "gh-bench" });
		const slot = (label: string, items: FeedItem[]) => {
			if (!items.length) return;
			const line = bench.createDiv();
			line.createSpan({ text: label + " " });
			items.forEach((i, n) => { if (n) line.createSpan({ text: " · " }); this.item(line, i, CAPS.bench); });
		};
		slot("🌅 Today:", feed.bench.today);
		slot("🌙 Grew overnight:", feed.bench.overnight);
		slot("✋ Waiting on you:", feed.bench.waiting);
		if (!feed.bench.today.length && !feed.bench.overnight.length && !feed.bench.waiting.length)
			bench.createSpan({ text: "a quiet day" });

		if (this.mode === "home") this.renderHome(wrap, feed);
		else this.renderTasks(wrap, feed);

		const keeper = feed.curation ? ` · keeper: ${feed.curation}` : "";
		wrap.createDiv({ cls: "gh-foot", text: `generated ${feed.generated_at}${keeper} · positions never change · light is earned by facts` });
		// async render completion must not steal focus from the editor
		if (this.app.workspace.getActiveViewOfType(GreenhouseView) === this) this.contentEl.focus();
	}

	private renderHome(wrap: HTMLElement, feed: Feed): void {
		for (const [tier, label, gcls] of TIERS) {
			const beds = feed.pillars.filter(p => p.tier === tier);
			if (!beds.length) continue;
			wrap.createDiv({ cls: "gh-tier", text: label });
			const grid = wrap.createDiv({ cls: `gh-grid ${gcls}` });
			beds.forEach(p => this.renderBed(grid, p));
		}
		if (feed.unsorted.length)
			wrap.createDiv({ cls: "gh-foot", text: "unsorted tray: " + feed.unsorted.map(u => u.name).join(", ") });
	}

	private renderBed(grid: HTMLElement, p: Pillar): void {
		const bed = grid.createEl("details", { cls: "gh-bed" });
		bed.dataset.pillar = p.id;
		if (p.glow) bed.addClass("glow");
		if (p.tier === "fallow") bed.addClass("fallow");
		const sum = bed.createEl("summary");
		sum.createDiv({ cls: "gh-bname", text: `${p.emoji} ${p.name}${p.glow ? " ☀" : ""} ${p.status}`.trim() });
		const aliveParts = p.alive.slice(0, 2).map(a => display(a, CAPS.alive));
		let aliveText = aliveParts.join(" · ");
		if (p.stirring) aliveText = ("◌ stirring · " + aliveText).replace(/ · $/, "");
		sum.createDiv({ cls: "gh-balive", text: aliveText || " " });

		const room = bed.createDiv({ cls: "gh-room" });
		if (p.purpose) { room.createDiv({ cls: "gh-lbl", text: "PURPOSE" }); room.createSpan({ text: p.purpose }); }
		if (p.projects.length) {
			room.createDiv({ cls: "gh-lbl", text: "PROJECTS" });
			p.projects.forEach(pr => {
				const el = room.createDiv({ cls: "gh-link", text: pr.name });
				el.onClickEvent(() => this.openSource(pr.desk + "/next-actions.md"));
			});
		}
		if (p.top_tasks.length) {
			room.createDiv({ cls: "gh-lbl", text: "TOP TASKS" });
			const aliveRaw = new Set(p.alive.map(a => a.text));
			const roomTasks = p.top_tasks.filter(t => !aliveRaw.has(t.text));
			(roomTasks.length ? roomTasks : p.top_tasks.slice(0, 1)).forEach(t => {
				const line = room.createDiv();
				this.item(line, t, CAPS.task);
			});
		}
		if (p.note) {
			const el = room.createDiv({ cls: "gh-lbl gh-link", text: "open pillar note →" });
			el.onClickEvent(() => this.openSource(p.note));
		}
	}

	private renderTasks(wrap: HTMLElement, feed: Feed): void {
		if (!feed.tasks_lens.length) { wrap.createEl("p", { text: "no tasks surfaced" }); return; }
		feed.tasks_lens.forEach(t => {
			const row = wrap.createDiv({ cls: "gh-task" });
			this.item(row, t, CAPS.task);
			row.createSpan({ text: `  (${t.pillar})`, cls: "gh-lbl" });
		});
	}
}
