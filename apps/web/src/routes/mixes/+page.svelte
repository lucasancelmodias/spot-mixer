<script lang="ts">
	import type { SavedMix } from '@spot-mixer/shared';
	import { forgetSavedMix, getMe, listSavedMixes, refreshSavedMix } from '#lib/api.js';
	import { describeError } from '#lib/errors.js';

	type Outcome = { kind: 'done' | 'error'; text: string; warnings: string[] };

	const me = getMe();
	let mixes = $state<SavedMix[] | null>(null);
	let loadError = $state<string | null>(null);
	let busy = $state<string | null>(null);
	let outcomes = $state<Record<string, Outcome>>({});

	async function load() {
		try {
			mixes = await listSavedMixes();
			loadError = null;
		} catch (error) {
			loadError = describeError(error);
		}
	}

	async function refresh(mix: SavedMix) {
		busy = mix.playlistId;
		try {
			const result = await refreshSavedMix(mix.playlistId);
			outcomes[mix.playlistId] = {
				kind: 'done',
				text: `Replaced the tracks of the playlist: ${result.tracks.length} new tracks.`,
				warnings: result.warnings
			};
			await load();
		} catch (error) {
			outcomes[mix.playlistId] = { kind: 'error', text: describeError(error), warnings: [] };
			await load();
		} finally {
			busy = null;
		}
	}

	async function forget(mix: SavedMix) {
		busy = mix.playlistId;
		try {
			await forgetSavedMix(mix.playlistId);
			await load();
		} catch (error) {
			outcomes[mix.playlistId] = { kind: 'error', text: describeError(error), warnings: [] };
		} finally {
			busy = null;
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
	}

	void me.then((user) => user && load());
</script>

<main>
	<h1>Saved mixes</h1>

	{#await me}
		<p>Checking your session…</p>
	{:then user}
		{#if !user}
			<p>Sign in with Spotify to see your saved mixes.</p>
			<!-- /auth/login is an API route, not a SvelteKit route: it needs a full page load, and resolve() does not apply. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="connect" href="/auth/login?returnTo=/mixes" data-sveltekit-reload>
				Connect with Spotify
			</a>
		{:else}
			<p class="lead">
				"Refresh" runs the recipe again with a new shuffle and your current listening, and replaces
				the tracks of the same playlist. A recipe expires 90 days after its last use. Logout also
				deletes it; the playlists stay in Spotify.
			</p>
			{#if loadError}
				<p class="error" role="alert">{loadError}</p>
			{:else if mixes === null}
				<p>Loading…</p>
			{:else if mixes.length === 0}
				<p class="hint">No saved mixes yet. Save a mix from Artist Mix or My Mix.</p>
			{:else}
				<ul class="mixes">
					{#each mixes as mix (mix.playlistId)}
						{@const outcome = outcomes[mix.playlistId]}
						<li>
							<div class="info">
								<!-- An absolute open.spotify.com URL from the API: resolve() does not apply. -->
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={mix.url} target="_blank" rel="noopener noreferrer">{mix.name}</a>
								<small>
									{mix.mode === 'me' ? 'My Mix' : 'Artist Mix'} · {mix.artistNames.join(', ')}
								</small>
								<small>
									{mix.trackCount} tracks · {mix.refreshedAt
										? `refreshed ${formatDate(mix.refreshedAt)}`
										: `saved ${formatDate(mix.createdAt)}`} · kept until {formatDate(mix.expiresAt)}
								</small>
								{#if outcome}
									<p class={outcome.kind === 'error' ? 'error' : 'hint'} role="status">
										{outcome.text}
									</p>
									{#each outcome.warnings as warning (warning)}
										<p class="warning">{warning}</p>
									{/each}
								{/if}
							</div>
							<div class="actions">
								<button
									type="button"
									class="primary"
									disabled={busy !== null}
									onclick={() => refresh(mix)}
								>
									{busy === mix.playlistId ? 'Refreshing…' : 'Refresh'}
								</button>
								<button type="button" disabled={busy !== null} onclick={() => forget(mix)}>
									Forget
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{:catch error}
		<p class="error" role="alert">{describeError(error)}</p>
	{/await}
</main>

<style>
	main {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	h1,
	p {
		margin: 0;
	}

	.lead {
		color: var(--muted);
	}

	.mixes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	li {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.info a {
		color: inherit;
		font-weight: 600;
	}

	small {
		color: var(--muted);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.warning {
		color: var(--warning);
	}
</style>
