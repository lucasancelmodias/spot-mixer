<script lang="ts">
	import type { MixPreview } from '@spot-mixer/shared';
	import { getMe, previewMix } from '#lib/api.js';
	import { Bucket } from '#lib/bucket.svelte.js';
	import ArtistSearch from '#lib/components/ArtistSearch.svelte';
	import BucketItem from '#lib/components/BucketItem.svelte';
	import MixOptionsForm from '#lib/components/MixOptionsForm.svelte';
	import SaveDialog from '#lib/components/SaveDialog.svelte';
	import TrackList from '#lib/components/TrackList.svelte';
	import { describeError } from '#lib/errors.js';
	import { formatTotal, mixName } from '#lib/format.js';

	const me = getMe();
	const bucket = new Bucket();
	bucket.load();
	$effect(() => bucket.save());

	let preview = $state<MixPreview | null>(null);
	let previewing = $state(false);
	let previewError = $state<string | null>(null);
	let playlistName = $state('');

	const sourceNames = $derived(
		Object.fromEntries(bucket.entries.map((entry) => [entry.artist.id, entry.artist.name]))
	);
	const totalMs = $derived(preview?.tracks.reduce((sum, track) => sum + track.durationMs, 0) ?? 0);
	const trackUris = $derived(preview?.tracks.map((track) => track.uri) ?? []);
	const needsAlbums = $derived(
		bucket.entries.some(({ source }) => source.kind === 'albums' && source.albums.length === 0)
	);

	async function runPreview(shuffleAgain: boolean) {
		if (shuffleAgain) bucket.newSeed();
		previewing = true;
		previewError = null;
		try {
			preview = await previewMix(bucket.recipe());
			playlistName = mixName(bucket.entries.map((entry) => entry.artist.name));
		} catch (error) {
			previewError = describeError(error);
		} finally {
			previewing = false;
		}
	}

	function removeTrack(index: number) {
		preview?.tracks.splice(index, 1);
	}

	function moveTrack(index: number, delta: -1 | 1) {
		const tracks = preview?.tracks;
		const moved = tracks?.[index];
		const other = tracks?.[index + delta];
		if (!tracks || !moved || !other) return;
		tracks[index] = other;
		tracks[index + delta] = moved;
	}
</script>

<main>
	<h1>Artist Mix</h1>

	{#await me}
		<p>Checking your session…</p>
	{:then user}
		{#if !user}
			<p>Sign in with Spotify to make a mix.</p>
			<!-- /auth/login is an API route, not a SvelteKit route: it needs a full page load, and resolve() does not apply. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="connect" href="/auth/login?returnTo=/mix/artists" data-sveltekit-reload>
				Connect with Spotify
			</a>
		{:else}
			<p class="lead">
				Add 2 to 12 artists. For each artist, choose popular tracks, your own favorites, or albums.
			</p>

			<ArtistSearch
				onadd={(artist) => bucket.add(artist)}
				isAdded={(artistId) => bucket.has(artistId)}
				disabled={bucket.full}
			/>

			{#if bucket.entries.length > 0}
				<h2>Artists in the mix ({bucket.entries.length})</h2>
				<ul class="bucket">
					{#each bucket.entries as entry (entry.artist.id)}
						<BucketItem
							{entry}
							onremove={() => bucket.remove(entry.artist.id)}
							onchange={(source) => bucket.setSource(entry.artist.id, source)}
						/>
					{/each}
				</ul>
			{/if}

			<MixOptionsForm bind:options={bucket.options} />

			<div class="actions">
				<button
					type="button"
					class="primary"
					disabled={!bucket.ready || previewing}
					onclick={() => runPreview(false)}
				>
					{previewing ? 'Building the mix…' : 'Preview the mix'}
				</button>
				{#if preview}
					<button
						type="button"
						disabled={!bucket.ready || previewing}
						onclick={() => runPreview(true)}
					>
						Shuffle again
					</button>
				{/if}
				{#if !bucket.ready}
					<span class="hint">
						{needsAlbums
							? 'Choose at least one album for each album source.'
							: 'Add at least 2 artists.'}
					</span>
				{/if}
			</div>
			{#if previewError}
				<p class="error" role="alert">{previewError}</p>
			{/if}

			{#if preview}
				<section class="preview" aria-label="Mix preview">
					<h2>Preview: {preview.tracks.length} tracks, {formatTotal(totalMs)}</h2>
					{#each preview.warnings as warning (warning)}
						<p class="warning">{warning}</p>
					{/each}
					<TrackList
						tracks={preview.tracks}
						{sourceNames}
						onremove={removeTrack}
						onmove={moveTrack}
					/>
					<SaveDialog bind:name={playlistName} {trackUris} />
				</section>
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
	h2,
	p {
		margin: 0;
	}

	.lead {
		color: var(--muted);
	}

	.bucket {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.preview {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.warning {
		color: var(--warning);
	}
</style>
