import type { KV } from '../cache/kv';
import { messageOf } from '../lib/async';

/**
 * Features that Spotify removed for apps created after 2026-02-11. It postponed the cuts for
 * existing apps such as this one, with no new date (docs/spike-results.md).
 */
export type Capability = 'topTracks' | 'batchReads' | 'pageSize50';

/**
 * What this app can still use (plan D2). The app uses a capability while it works. When Spotify
 * refuses it, the app records the loss and uses the fallback. The record expires after 6 hours,
 * so a short outage does not turn a feature off for good.
 */
export interface Capabilities {
	has(capability: Capability): Promise<boolean>;
	lose(capability: Capability, reason: string): Promise<void>;
}

const LOSS_TTL_SECONDS = 6 * 60 * 60;

export class KVCapabilities implements Capabilities {
	constructor(
		private readonly kv: KV,
		private readonly log: (line: string) => void
	) {}

	async has(capability: Capability): Promise<boolean> {
		try {
			return (await this.kv.get(lossKey(capability))) === null;
		} catch {
			// Without Redis, try the capability. A refusal then only costs one call.
			return true;
		}
	}

	async lose(capability: Capability, reason: string): Promise<void> {
		this.log(`[spotify] capability lost for 6 hours: ${capability} (${reason})`);
		try {
			await this.kv.set(lossKey(capability), reason, LOSS_TTL_SECONDS);
		} catch (error) {
			this.log(`[spotify] could not record the lost capability: ${messageOf(error)}`);
		}
	}
}

function lossKey(capability: Capability): string {
	return `cap:lost:${capability}`;
}
