export interface FeedItem { text: string; source: string; short?: string }
export interface PillarProject { name: string; desk: string }
export interface Pillar {
	id: string; emoji: string; name: string; tier: string; status: string;
	purpose: string; note: string; alive: FeedItem[]; top_tasks: FeedItem[];
	projects: PillarProject[]; glow: boolean; stirring: boolean;
}
export interface TaskLensItem { pillar: string; text: string; source: string; short?: string }
export interface Feed {
	generated_at: string; date: string; curation?: string;
	bench: { today: FeedItem[]; overnight: FeedItem[]; waiting: FeedItem[] };
	pillars: Pillar[]; tasks_lens: TaskLensItem[]; unsorted: { name: string; desk: string }[];
}
