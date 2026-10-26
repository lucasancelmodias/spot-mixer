import type { ArtistSummary, MixOptions, MixRecipe, SourceSpec } from '@spot-mixer/shared';
import { MAX_MIX_ARTISTS, MAX_SOURCE_COUNT, MIN_MIX_ARTISTS } from '@spot-mixer/shared/limits';

export type AlbumChoice = { id: string; name: string };

export type BucketSource =
	| { kind: 'popular'; count: number }
	| { kind: 'favorites'; count: number }
	| { kind: 'albums'; albums: AlbumChoice[]; randomPerAlbum: number | null };

export type BucketEntry = { artist: ArtistSummary; source: BucketSource };

type StoredDraft = { version: 1; entries: BucketEntry[]; options: MixOptions };

const STORAGE_KEY = 'spot-mixer:artist-mix';
export const DEFAULT_COUNT = 10;

export function randomSeed(): number {
	return Math.floor(Math.random() * 2_147_483_647);
}

export function defaultOptions(): MixOptions {
	return {
		maxTracks: null,
		order: 'balanced-shuffle',
		noAdjacentSameArtist: true,
		exclude: [],
		seed: randomSeed()
	};
}

/** A whole number from 1 to MAX_SOURCE_COUNT. */
export function clampCount(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_COUNT;
	return Math.min(MAX_SOURCE_COUNT, Math.max(1, Math.round(value)));
}

/**
 * The artists of an Artist Mix and where their tracks come from (plan §3.1).
 * The draft is kept in localStorage as a convenience only: the app works without it.
 */
export class Bucket {
	entries = $state<BucketEntry[]>([]);
	options = $state<MixOptions>(defaultOptions());
	private readonly storage: Storage | null;

	constructor(storage: Storage | null = browserStorage()) {
		this.storage = storage;
	}

	get full(): boolean {
		return this.entries.length >= MAX_MIX_ARTISTS;
	}

	/** At least 2 artists, and every album source has at least one album. */
	get ready(): boolean {
		return (
			this.entries.length >= MIN_MIX_ARTISTS &&
			this.entries.every(({ source }) => source.kind !== 'albums' || source.albums.length > 0)
		);
	}

	has(artistId: string): boolean {
		return this.entries.some((entry) => entry.artist.id === artistId);
	}

	add(artist: ArtistSummary): void {
		if (this.full || this.has(artist.id)) return;
		// A plain copy: the search results belong to another component's state.
		const copy = $state.snapshot(artist);
		this.entries.push({ artist: copy, source: { kind: 'popular', count: DEFAULT_COUNT } });
	}

	remove(artistId: string): void {
		this.entries = this.entries.filter((entry) => entry.artist.id !== artistId);
	}

	setSource(artistId: string, source: BucketSource): void {
		const entry = this.entries.find((candidate) => candidate.artist.id === artistId);
		if (entry) entry.source = source;
	}

	newSeed(): void {
		this.options.seed = randomSeed();
	}

	recipe(): MixRecipe {
		return {
			sources: this.entries.map(({ artist, source }) => toSpec(artist.id, source)),
			options: $state.snapshot(this.options)
		};
	}

	load(): void {
		try {
			const raw = this.storage?.getItem(STORAGE_KEY);
			if (!raw) return;
			const draft = JSON.parse(raw) as Partial<StoredDraft>;
			if (draft.version !== 1 || !Array.isArray(draft.entries) || !draft.options) return;
			this.entries = draft.entries.slice(0, MAX_MIX_ARTISTS);
			this.options = { ...defaultOptions(), ...draft.options };
		} catch {
			// A broken draft is ignored.
		}
	}

	save(): void {
		try {
			const draft: StoredDraft = {
				version: 1,
				entries: $state.snapshot(this.entries),
				options: $state.snapshot(this.options)
			};
			this.storage?.setItem(STORAGE_KEY, JSON.stringify(draft));
		} catch {
			// Private mode or full storage: the draft is a convenience only.
		}
	}
}

function toSpec(artistId: string, source: BucketSource): SourceSpec {
	switch (source.kind) {
		case 'popular':
		case 'favorites':
			return { kind: source.kind, artistId, count: clampCount(source.count) };
		case 'albums':
			return {
				kind: 'albums',
				artistId,
				albumIds: source.albums.map((album) => album.id),
				randomPerAlbum: source.randomPerAlbum
			};
	}
}

function browserStorage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}
