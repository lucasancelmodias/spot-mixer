/** The operation needs more Spotify calls than its budget allows. */
export class CallBudgetExceededError extends Error {
	constructor(
		readonly limit: number,
		readonly route: string
	) {
		super(`The operation needs more than ${limit} Spotify calls (stopped before ${route})`);
		this.name = 'CallBudgetExceededError';
	}
}

/**
 * Limits the Spotify calls of one operation, for example one mix preview (plan §5.4).
 * Every HTTP call counts, retries included. Cache hits cost nothing.
 */
export class CallBudget {
	private used = 0;

	constructor(readonly limit: number) {}

	spend(route: string): void {
		if (this.used >= this.limit) throw new CallBudgetExceededError(this.limit, route);
		this.used += 1;
	}

	get spent(): number {
		return this.used;
	}
}
