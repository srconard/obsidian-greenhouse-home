import { App, requestUrl } from "obsidian";
import type { Feed } from "./types";
import type { GreenhouseSettings } from "./settings";

export const FEED_PATH = "AGENTS/dashboard/feed.json";

function timeout(ms: number): Promise<never> {
	return new Promise((_, reject) => setTimeout(() => reject(new Error(`fetch timeout ${ms}ms`)), ms));
}

export async function loadFeed(
	app: App, settings: GreenhouseSettings, forceFetch: boolean,
): Promise<{ feed: Feed | null; fresh: boolean; error?: string }> {
	let cached: Feed | null = null;
	let cacheErr = "";
	try {
		cached = JSON.parse(await app.vault.adapter.read(FEED_PATH)) as Feed;
	} catch (e) {
		cacheErr = String(e);
	}
	if (forceFetch) {
		try {
			const url = settings.bridgeUrl.replace(/\/+$/, "") + "/greenhouse/feed.json";
			const req = requestUrl({ url, throw: true });
			// if the timeout wins the race, the late rejection must not surface as unhandled
			req.catch(() => null);
			const resp = await Promise.race([req, timeout(settings.fetchTimeoutMs)]);
			const raw = resp.text;
			const feed = JSON.parse(raw) as Feed;
			// an on-demand local regen can be newer than the NAS 5:15 compile —
			// never clobber a fresher cache (ISO timestamps compare lexicographically)
			if (cached && cached.generated_at > feed.generated_at) {
				return { feed: cached, fresh: true };
			}
			await app.vault.adapter.write(FEED_PATH, raw);
			return { feed, fresh: true };
		} catch (e) { /* fall through to cache */ }
	}
	if (cached) return { feed: cached, fresh: false };
	return { feed: null, fresh: false, error: cacheErr || "no cached feed" };
}
