import { App, PluginSettingTab, Setting } from "obsidian";
import type GreenhousePlugin from "./main";

// "obsidian" follows the active Obsidian theme live (both halves); "greenhouse" is the original day/night skin
export type GreenhouseTheme = "obsidian" | "greenhouse";

// where the greenhouse opens: a main-pane tab, or the left / right sidebar (phone: that drawer)
export type GreenhouseLocation = "main" | "left" | "right";
export const LOCATION_LABELS: Record<GreenhouseLocation, string> = {
	main: "Main pane",
	left: "Left side panel",
	right: "Right side panel",
};

export interface GreenhouseSettings {
	openOnStartup: boolean;
	location: GreenhouseLocation;
	bridgeUrl: string;
	fetchTimeoutMs: number;
	fontScale: number;
	theme: GreenhouseTheme;
}

export const DEFAULT_SETTINGS: GreenhouseSettings = {
	openOnStartup: true,
	location: "main",
	bridgeUrl: "http://100.97.68.101:8787",
	fetchTimeoutMs: 5000,
	fontScale: 1.0,
	theme: "obsidian",
};

export class GreenhouseSettingTab extends PluginSettingTab {
	plugin: GreenhousePlugin;
	constructor(app: App, plugin: GreenhousePlugin) { super(app, plugin); this.plugin = plugin; }
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl).setName("Open on startup")
			.setDesc("Open the greenhouse as the home view when Obsidian launches.")
			.addToggle(t => t.setValue(this.plugin.settings.openOnStartup)
				.onChange(async v => { this.plugin.settings.openOnStartup = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName("Where it opens")
			.setDesc("Main pane (a tab), or the left / right side panel — on the phone that is the drawer you swipe in from that edge. Also on the ⚙ button in the view; changing it moves an open greenhouse.")
			.addDropdown(d => {
				(Object.keys(LOCATION_LABELS) as GreenhouseLocation[]).forEach(k => d.addOption(k, LOCATION_LABELS[k]));
				d.setValue(this.plugin.settings.location)
					.onChange(async v => { await this.plugin.moveTo(v as GreenhouseLocation); });
			});
		new Setting(containerEl).setName("Bridge URL")
			.setDesc("NAS bridge base URL serving /greenhouse/feed.json (Tailscale).")
			.addText(t => t.setValue(this.plugin.settings.bridgeUrl)
				.onChange(async v => { this.plugin.settings.bridgeUrl = v.trim(); await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName("Theme")
			.setDesc("Match Obsidian follows your Obsidian theme live, light and dark. Greenhouse is the original day/night skin, switched by the clock. Also on the ⚙ button in the view.")
			.addDropdown(d => d.addOption("obsidian", "Match Obsidian").addOption("greenhouse", "Greenhouse (day · night)")
				.setValue(this.plugin.settings.theme)
				.onChange(async v => { this.plugin.settings.theme = v as GreenhouseTheme; await this.plugin.saveSettings(); this.plugin.refreshViews(); }));
		new Setting(containerEl).setName("Text size")
			.setDesc("Scale of the greenhouse text, on top of Obsidian's font size (A−/A+ in the view change this too).")
			.addSlider(sl => sl.setLimits(0.7, 2.0, 0.1).setDynamicTooltip().setValue(this.plugin.settings.fontScale)
				.onChange(async v => { this.plugin.settings.fontScale = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName("Fetch timeout (ms)")
			.addText(t => t.setValue(String(this.plugin.settings.fetchTimeoutMs))
				.onChange(async v => {
					const n = Number(v); if (Number.isFinite(n) && n > 0) { this.plugin.settings.fetchTimeoutMs = n; await this.plugin.saveSettings(); }
				}));
	}
}
