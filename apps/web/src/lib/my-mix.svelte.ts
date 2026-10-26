import type { MixOptions, MixRecipe, RankedArtist } from '@spot-mixer/shared';
import { MAX_MIX_ARTISTS, MIN_MIX_ARTISTS } from '@spot-mixer/shared/limits';
import { clampCount, DEFAULT_COUNT, defaultOptions, randomSeed } from './bucket.svelte';

export type MyMixSettings = {
	/** 0 ranks by all-time listening, 1 by what the user plays now. */
	recency: number;
	/** Share of the tracks from the user's own top and saved tracks, 0 to 1. */
	familiarShare: number;
	/** Tracks per artist. */
	count: number;
	/** How many artists from the top of the ranking to select. */
	artistCount: number;
};

type StoredDraft = { version: 1; settings: MyMixSettings; options: MixOptions };

const STORAGE_KEY = 'spot-mixer:my-mix';
export const DEFAULT_ARTIST_COUNT = 5;

export function defaultSettings(): MyMixSettings {
	return {
		recency: 0.5,
		familiarShare: 0.6,
		count: DEFAULT_COUNT,
		artistCount: DEFAULT_ARTIST_COUNT
	};
}

/** A whole number from MIN_MIX_ARTISTS to MAX_MIX_ARTISTS. */
export function clampArtistCount(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_ARTIST_COUNT;
	return Math.min(MAX_MIX_ARTISTS, Math.max(MIN_MIX_ARTISTS, Math.round(value)));
}

/** A number from 0 to 1. */
function clampShare(value: number): number {
	return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

/**
 * The state of a My Mix (plan §3.2): the ranking, the selected artists and the settings.
 * The settings are kept in localStorage as a convenience. The ranking and the selection are not:
 * the ranking is never stored (plan §7.2).
 */
export class MyMix {
	ranking = $state<RankedArtist[]>([]);
	/** IDs of the selected artists. */
	selected = $state<string[]>([]);
	/** True while the selection is the top of the ranking. A manual change turns it off. */
	followsTop = $state(true);
	settings = $state<MyMixSettings>(defaultSettings());
	options = $state<MixOptions>(defaultOptions());
	private readonly storage: Storage | null;

	constructor(storage: Storage | null = browserStorage()) {
		this.storage = storage;
	}

	/** The selected artists, in ranking order. */
	get selectedArtists(): RankedArtist[] {
		return this.ranking.filter((artist) => this.selected.includes(artist.id));
	}

	get full(): boolean {
		return this.selected.length >= MAX_MIX_ARTISTS;
	}

	get ready(): boolean {
		return this.selectedArtists.length >= MIN_MIX_ARTISTS;
	}

	/** A new ranking keeps a manual selection, as far as its artists are still in the ranking. */
	setRanking(artists: RankedArtist[]): void {
		this.ranking = artists;
		if (this.followsTop) {
			this.selectTop(this.settings.artistCount);
			return;
		}
		this.selected = this.selected.filter((id) => artists.some((artist) => artist.id === id));
	}

	selectTop(count: number): void {
		this.settings.artistCount = clampArtistCount(count);
		this.followsTop = true;
		this.selected = this.ranking.slice(0, this.settings.artistCount).map((artist) => artist.id);
	}

	toggle(artistId: string): void {
		this.followsTop = false;
		if (this.selected.includes(artistId)) {
			this.selected = this.selected.filter((id) => id !== artistId);
		} else if (!this.full) {
			this.selected = [...this.selected, artistId];
		}
	}

	newSeed(): void {
		this.options.seed = randomSeed();
	}

	recipe(): MixRecipe {
		const count = clampCount(this.settings.count);
		const familiarShare = clampShare(this.settings.familiarShare);
		return {
			sources: this.selectedArtists.map((artist) => ({
				kind: 'blend',
				artistId: artist.id,
				count,
				familiarShare
			})),
			options: $state.snapshot(this.options)
		};
	}

	load(): void {
		try {
			const raw = this.storage?.getItem(STORAGE_KEY);
			if (!raw) return;
			const draft = JSON.parse(raw) as Partial<StoredDraft>;
			if (draft.version !== 1 || !draft.settings || !draft.options) return;
			const settings = { ...defaultSettings(), ...draft.settings };
			this.settings = {
				recency: clampShare(settings.recency),
				familiarShare: clampShare(settings.familiarShare),
				count: clampCount(settings.count),
				artistCount: clampArtistCount(settings.artistCount)
			};
			this.options = { ...defaultOptions(), ...draft.options };
		} catch {
			// A broken draft is ignored.
		}
	}

	save(): void {
		try {
			const draft: StoredDraft = {
				version: 1,
				settings: $state.snapshot(this.settings),
				options: $state.snapshot(this.options)
			};
			this.storage?.setItem(STORAGE_KEY, JSON.stringify(draft));
		} catch {
			// Private mode or full storage: the draft is a convenience only.
		}
	}
}

function browserStorage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}
