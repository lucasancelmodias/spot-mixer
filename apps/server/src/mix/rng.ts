export type Rng = () => number;

/** A seeded random number generator (mulberry32). The same seed gives the same numbers. */
export function createRng(seed: number): Rng {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/** A shuffled copy (Fisher-Yates). */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		const swap = copy[i] as T;
		copy[i] = copy[j] as T;
		copy[j] = swap;
	}
	return copy;
}

/** `count` random items, in their original order. */
export function sampleInOrder<T>(items: readonly T[], count: number, rng: Rng): T[] {
	const chosen = new Set(
		shuffled(
			items.map((_, index) => index),
			rng
		).slice(0, count)
	);
	return items.filter((_, index) => chosen.has(index));
}
