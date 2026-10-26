<script lang="ts">
	import type { SaveMixResponse } from '@spot-mixer/shared';
	import { ApiError, saveMix } from '#lib/api.js';
	import { describeError } from '#lib/errors.js';

	let { name = $bindable(), trackUris }: { name: string; trackUris: string[] } = $props();

	let description = $state('Made with spot-mixer.');
	let saving = $state(false);
	let saved = $state<SaveMixResponse | null>(null);
	let error = $state<string | null>(null);
	let incompleteUrl = $state<string | null>(null);

	async function save() {
		saving = true;
		error = null;
		incompleteUrl = null;
		try {
			saved = await saveMix({ name: name.trim(), description: description.trim(), trackUris });
		} catch (caught) {
			error = describeError(caught);
			if (caught instanceof ApiError && typeof caught.body.playlistUrl === 'string') {
				incompleteUrl = caught.body.playlistUrl;
			}
		} finally {
			saving = false;
		}
	}
</script>

<section class="save" aria-label="Save to Spotify">
	{#if saved}
		<p>Saved {saved.added} tracks as a private playlist.</p>
		<div class="row">
			<!-- An absolute open.spotify.com URL from the API, not an app route: resolve() does not apply. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="open" href={saved.url} target="_blank" rel="noopener noreferrer">OPEN SPOTIFY</a>
			<button type="button" onclick={() => (saved = null)}>Save another copy</button>
		</div>
	{:else}
		<form
			onsubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<label>
				Playlist name
				<input bind:value={name} maxlength="100" required />
			</label>
			<label>
				Description
				<input bind:value={description} maxlength="300" />
			</label>
			<button
				type="submit"
				class="primary"
				disabled={saving || !name.trim() || trackUris.length === 0}
			>
				{saving ? 'Saving…' : `Save ${trackUris.length} tracks to Spotify`}
			</button>
		</form>
		<p class="hint">The playlist is private. You can change that in Spotify.</p>
	{/if}
	{#if error}
		<p class="error" role="alert">
			{error}
			{#if incompleteUrl}
				<!-- An absolute open.spotify.com URL from the API: resolve() does not apply. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={incompleteUrl} target="_blank" rel="noopener noreferrer">Open the playlist</a>
			{/if}
		</p>
	{/if}
</section>

<style>
	.save {
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: end;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1 1 14rem;
	}

	.row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.open {
		display: inline-block;
		padding: 0.5rem 1.25rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-fg);
		font-weight: 700;
		text-decoration: none;
	}
</style>
