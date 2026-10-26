<script lang="ts">
	import type { ArtistSummary } from '@spot-mixer/shared';
	import { searchArtists } from '#lib/api.js';
	import { describeError } from '#lib/errors.js';

	let {
		onadd,
		isAdded,
		disabled = false
	}: {
		onadd: (artist: ArtistSummary) => void;
		isAdded: (artistId: string) => boolean;
		disabled?: boolean;
	} = $props();

	let query = $state('');
	let results = $state<ArtistSummary[]>([]);
	let error = $state<string | null>(null);
	let searching = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest = 0;

	function onInput() {
		clearTimeout(timer);
		const text = query.trim();
		if (text.length < 2) {
			results = [];
			error = null;
			return;
		}
		timer = setTimeout(() => void search(text), 300);
	}

	async function search(text: string) {
		const ticket = ++latest;
		searching = true;
		try {
			const found = await searchArtists(text);
			// Ignore answers to older queries.
			if (ticket === latest) {
				results = found;
				error = null;
			}
		} catch (caught) {
			if (ticket === latest) error = describeError(caught);
		} finally {
			if (ticket === latest) searching = false;
		}
	}
</script>

<div class="artist-search">
	<label for="artist-search">Add an artist</label>
	<input
		id="artist-search"
		type="search"
		placeholder="Type an artist name"
		autocomplete="off"
		bind:value={query}
		oninput={onInput}
		{disabled}
	/>
	{#if disabled}
		<p class="hint">The mix has the maximum number of artists.</p>
	{:else if searching}
		<p class="hint">Searching…</p>
	{/if}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	{#if results.length > 0}
		<ul class="results">
			{#each results as artist (artist.id)}
				<li>
					{#if artist.imageUrl}
						<img src={artist.imageUrl} alt="" width="40" height="40" />
					{:else}
						<span class="no-image" aria-hidden="true"></span>
					{/if}
					<span class="name">
						{artist.name}
						{#if artist.genres.length > 0}
							<small>{artist.genres.slice(0, 2).join(', ')}</small>
						{/if}
					</span>
					<button
						type="button"
						onclick={() => onadd(artist)}
						disabled={disabled || isAdded(artist.id)}
					>
						{isAdded(artist.id) ? 'Added' : 'Add'}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.artist-search input {
		width: 100%;
		box-sizing: border-box;
	}

	.results {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.results li {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem 0.75rem;
	}

	.results li + li {
		border-top: 1px solid var(--border);
	}

	.results img,
	.no-image {
		width: 40px;
		height: 40px;
		border-radius: 4px;
		object-fit: contain;
		background: var(--surface);
	}

	.name {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	small {
		color: var(--muted);
	}
</style>
