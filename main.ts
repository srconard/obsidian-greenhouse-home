import { Plugin } from "obsidian";
import { GreenhouseView, VIEW_TYPE } from "./view";
import { DEFAULT_SETTINGS, GreenhouseSettings, GreenhouseSettingTab } from "./settings";

export default class GreenhousePlugin extends Plugin {
	settings: GreenhouseSettings;

	async onload() {
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new GreenhouseView(leaf, this));
		this.addCommand({ id: "open-greenhouse", name: "Open greenhouse home", callback: () => this.activateView() });
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

	async activateView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		const leaf = leaves[0] ?? this.app.workspace.getLeaf(true);
		for (const extra of leaves.slice(1)) extra.detach();
		await leaf.setViewState({ type: VIEW_TYPE, active: true });
		this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		// startup race guard: if onOpen's load didn't land a feed, retry once
		if (view instanceof GreenhouseView && !view.hasFeed()) await view.reload(true);
	}

	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}
