import { Plugin } from "obsidian";
import { GreenhouseView, VIEW_TYPE } from "./view";
import { DEFAULT_SETTINGS, GreenhouseLocation, GreenhouseSettings, GreenhouseSettingTab, LOCATION_LABELS } from "./settings";
import { Notice, WorkspaceLeaf } from "obsidian";

export default class GreenhousePlugin extends Plugin {
	settings: GreenhouseSettings;

	async onload() {
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new GreenhouseView(leaf, this));
		this.addCommand({ id: "open-greenhouse", name: "Open greenhouse home", callback: () => this.activateView() });
		// explicit-location commands: pick and remember (v1.3.0, Shawn 2026-09-13: "an option to open it in the side panel on the left")
		(Object.keys(LOCATION_LABELS) as GreenhouseLocation[]).forEach(loc => {
			this.addCommand({
				id: `open-greenhouse-${loc}`,
				name: `Open greenhouse in: ${LOCATION_LABELS[loc].toLowerCase()}`,
				callback: () => this.moveTo(loc),
			});
		});
		this.registerObsidianProtocolHandler("greenhouse", () => this.activateView());
		this.addSettingTab(new GreenhouseSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.openOnStartup) {
				// detach any workspace-restored greenhouse leaves first: guarantees
				// exactly one live (non-deferred) leaf whose onOpen runs post-layout
				this.app.workspace.detachLeavesOfType(VIEW_TYPE);
				this.activateView();
			}
		});
	}

	/** Which side of the workspace a leaf lives in — "main" for the root split. */
	private leafLocation(leaf: WorkspaceLeaf): GreenhouseLocation {
		const root = leaf.getRoot();
		if (root === this.app.workspace.leftSplit) return "left";
		if (root === this.app.workspace.rightSplit) return "right";
		return "main";
	}

	/** A fresh leaf where the settings say the greenhouse lives. Sidebar leaves can be null when that sidebar is unavailable → main pane. */
	private leafFor(loc: GreenhouseLocation): WorkspaceLeaf {
		const ws = this.app.workspace;
		const leaf = loc === "left" ? ws.getLeftLeaf(false) : loc === "right" ? ws.getRightLeaf(false) : ws.getLeaf(true);
		if (!leaf) new Notice(`Greenhouse: the ${LOCATION_LABELS[loc].toLowerCase()} isn't available here — opening in the main pane`);
		return leaf ?? ws.getLeaf(true);
	}

	/** Change where the greenhouse opens, remember it, and move an open one there now. */
	async moveTo(loc: GreenhouseLocation): Promise<void> {
		this.settings.location = loc;
		await this.saveSettings();
		await this.activateView();
	}

	async activateView() {
		const loc = this.settings.location ?? "main";
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		// an existing greenhouse on the wrong side is closed, not reused: a leaf cannot be moved across splits
		let leaf = leaves.find(l => this.leafLocation(l) === loc) ?? null;
		for (const extra of leaves) if (extra !== leaf) extra.detach();
		leaf ??= this.leafFor(loc);
		await leaf.setViewState({ type: VIEW_TYPE, active: true });
		this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		// startup race guard: if onOpen's load didn't land a feed, retry once
		if (view instanceof GreenhouseView && !view.hasFeed()) await view.reload(true);
	}

	// re-apply the theme on every open greenhouse view (settings-tab changes)
	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			if (leaf.view instanceof GreenhouseView) leaf.view.applyTheme();
		}
	}

	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}
