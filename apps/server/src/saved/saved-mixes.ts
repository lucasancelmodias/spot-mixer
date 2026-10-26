import {
	MAX_SAVED_MIXES,
	SAVED_MIX_TTL_DAYS,
	type SavedMix,
	savedMixSchema
} from '@spot-mixer/shared';
import { userCacheKey } from '../cache/keys';
import type { KV } from '../cache/kv';

const TTL_MS = SAVED_MIX_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * The saved mix recipes of each user (plan D5), in one key under the user cache prefix, so that
 * logout and "delete my data" remove them at once. Each recipe expires SAVED_MIX_TTL_DAYS after
 * its last save or refresh; the key expires with the newest one.
 */
export class SavedMixes {
	constructor(private readonly deps: { kv: KV; now: () => number }) {}

	/** The live recipes, the last used first. */
	async list(uid: string): Promise<SavedMix[]> {
		const raw = await this.deps.kv.get(key(uid));
		if (raw === null) return [];
		const now = this.deps.now();
		return parseList(raw)
			.filter((mix) => Date.parse(mix.expiresAt) > now)
			.sort((a, b) => lastUse(b).localeCompare(lastUse(a)));
	}

	async get(uid: string, playlistId: string): Promise<SavedMix | null> {
		return (await this.list(uid)).find((mix) => mix.playlistId === playlistId) ?? null;
	}

	/** Adds or replaces the recipe of a playlist, and restarts its time limit. */
	async put(uid: string, mix: Omit<SavedMix, 'expiresAt'>): Promise<SavedMix> {
		const now = this.deps.now();
		const saved: SavedMix = { ...mix, expiresAt: new Date(now + TTL_MS).toISOString() };
		const others = (await this.list(uid)).filter((item) => item.playlistId !== mix.playlistId);
		await this.write(uid, [saved, ...others].slice(0, MAX_SAVED_MIXES));
		return saved;
	}

	/** True when a recipe was removed. The Spotify playlist stays. */
	async remove(uid: string, playlistId: string): Promise<boolean> {
		const mixes = await this.list(uid);
		const kept = mixes.filter((mix) => mix.playlistId !== playlistId);
		if (kept.length === mixes.length) return false;
		await this.write(uid, kept);
		return true;
	}

	private async write(uid: string, mixes: SavedMix[]): Promise<void> {
		if (mixes.length === 0) {
			await this.deps.kv.del(key(uid));
			return;
		}
		const latest = Math.max(...mixes.map((mix) => Date.parse(mix.expiresAt)));
		const ttlSeconds = Math.max(1, Math.ceil((latest - this.deps.now()) / 1000));
		await this.deps.kv.set(key(uid), JSON.stringify(mixes), ttlSeconds);
	}
}

function key(uid: string): string {
	return userCacheKey(uid, 'mixes');
}

function lastUse(mix: SavedMix): string {
	return mix.refreshedAt ?? mix.createdAt;
}

/** Drops entries that do not match the schema, so that one bad entry does not hide the rest. */
function parseList(raw: string): SavedMix[] {
	let values: unknown;
	try {
		values = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(values)) return [];
	return values.flatMap((value) => {
		const parsed = savedMixSchema.safeParse(value);
		return parsed.success ? [parsed.data] : [];
	});
}
