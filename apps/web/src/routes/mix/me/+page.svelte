<script lang="ts">
	import { resolve } from '$app/paths';
	import type { MixPreview, MixRecipe } from '@spot-mixer/shared';
	import { MAX_MIX_ARTISTS, MAX_SOURCE_COUNT, MIN_MIX_ARTISTS } from '@spot-mixer/shared/limits';
	import { getArtistInsights, getMe, previewMix } from '#lib/api.js';
	import { clampCount } from '#lib/bucket.svelte.js';
	import MixOptionsForm from '#lib/components/MixOptionsForm.svelte';
	import RankedArtistList from '#lib/components/RankedArtistList.svelte';
	import SaveDialog from '#lib/components/SaveDialog.svelte';
	import TrackList from '#lib/components/TrackList.svelte';
	import { describeError } from '#lib/errors.js';
	import { formatTotal, mixName } from '#lib/format.js';
	import { MyMix } from '#lib/my-mix.svelte.js';

	const me = getMe();
	const myMix = new MyMix();
	myMix.load();
	$effect(() => myMix.save());

	let analyzing = $state(false);
	let analyzed = $state(false);
	let analysisError = $state<string | null>(null);
	let latest = 0;

	let preview = $state<MixPreview | null>(null);
	let previewing = $state(false);
	let previewError = $state<string | null>(null);
	let playlistName = $state('');
	/** The recipe of the shown preview, kept with the playlist for "refresh mix". */
	let previewRecipe = $state<MixRecipe | null>(null);

	const sourceNames = $derived(
		Object.fromEntries(myMix.ranking.map((artist) => [artist.id, artist.name]))
	);
	const totalMs = $derived(preview?.tracks.reduce((sum, track) => sum + track.durationMs, 0) ?? 0);
	const trackUris = $derived(preview?.tracks.map((track) => track.uri) ?? []);
	const familiarPercent = $derived(Math.round(myMix.settings.familiarShare * 100));

	// Opening the page is the user action that reads the listening data (no background reads).
	me.then((user) => {
		if (user) void analyze();
	}).catch(() => {
		// The template shows the session error.
	});

	async function analyze() {
		const ticket = ++latest;
		analyzing = true;
		analysisError = null;
		try {
			const insights = await getArtistInsights({ recency: myMix.settings.recency });
			// Ignore answers to older requests.
			if (ticket !== latest) return;
			myMix.setRanking(insights.artists);
			analyzed = true;
		} catch (error) {
			if (ticket === latest) analysisError = describeError(error);
		} finally {
			if (ticket === latest) analyzing = false;
		}
	}

	function setRecency(value: number) {
		myMix.settings.recency = value;
		void analyze();
	}

	async function runPreview(shuffleAgain: boolean) {
		if (shuffleAgain) myMix.newSeed();
		previewing = true;
		previewError = null;
		try {
			const recipe = myMix.recipe();
			preview = await previewMix(recipe);
			previewRecipe = recipe;
			playlistName = mixName(myMix.selectedArtists.map((artist) => artist.name));
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
	<h1>My Mix</h1>

	{#await me}
		<p>Checking your session…</p>
	{:then user}
		{#if !user}
			<p>Sign in with Spotify to make a mix of your most-listened artists.</p>
			<!-- /auth/login is an API route, not a SvelteKit route: it needs a full page load, and resolve() does not apply. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="connect" href="/auth/login?returnTo=/mix/me" data-sveltekit-reload>
				Connect with Spotify
			</a>
		{:else}
			<p class="lead">
				Your most-listened artists, from your top artists and tracks, your saved tracks, your last
				50 plays and the artists that you follow on Spotify. The ranking is made for you when you
				open this page, and the app does not keep it.
			</p>

			<fieldset class="settings">
				<legend>Your artists</legend>
				<label class="slider">
					Rank by
					<span class="range">
						<span class="end">All time</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.25"
							value={myMix.settings.recency}
							onchange={(event) => setRecency(event.currentTarget.valueAsNumber)}
						/>
						<span class="end">Right now</span>
					</span>
				</label>
				<div class="row">
					<label>
						Number of artists
						<input
							type="number"
							min={MIN_MIX_ARTISTS}
							max={MAX_MIX_ARTISTS}
							value={myMix.settings.artistCount}
							onchange={(event) => myMix.selectTop(event.currentTarget.valueAsNumber)}
						/>
					</label>
					{#if !myMix.followsTop}
						<button type="button" onclick={() => myMix.selectTop(myMix.settings.artistCount)}>
							Select the top {myMix.settings.artistCount}
						</button>
					{/if}
					<span class="hint">{myMix.selected.length} selected</span>
				</div>
			</fieldset>

			{#if analyzing}
				<p class="hint" role="status">
					Reading your Spotify listening… The first time can take up to half a minute.
				</p>
			{/if}
			{#if analysisError}
				<p class="error" role="alert">
					{analysisError}
					<button type="button" onclick={() => void analyze()}>Try again</button>
				</p>
			{/if}
			{#if analyzed && myMix.ranking.length === 0}
				<p>
					Spotify has no listening data for your account yet. Listen on Spotify for a while, or make
					an <a href={resolve('/mix/artists')}>Artist Mix</a>.
				</p>
			{:else if myMix.ranking.length > 0}
				<RankedArtistList
					artists={myMix.ranking}
					selected={myMix.selected}
					full={myMix.full}
					ontoggle={(artistId) => myMix.toggle(artistId)}
				/>
			{/if}

			<fieldset class="settings">
				<legend>Tracks</legend>
				<label class="slider">
					<span class="range">
						<span class="end">Familiar</span>
						<input
							type="range"
							min="0"
							max="100"
							step="10"
							value={familiarPercent}
							oninput={(event) =>
								(myMix.settings.familiarShare = event.currentTarget.valueAsNumber / 100)}
						/>
						<span class="end">Discovery</span>
					</span>
				</label>
				<p class="hint">
					{familiarPercent}% familiar: your top and saved tracks by each artist. {100 -
						familiarPercent}% discovery: the artist's popular tracks that are not among them.
				</p>
				<label>
					Tracks per artist
					<input
						type="number"
						min="1"
						max={MAX_SOURCE_COUNT}
						value={myMix.settings.count}
						onchange={(event) =>
							(myMix.settings.count = clampCount(event.currentTarget.valueAsNumber))}
					/>
				</label>
			</fieldset>

			<MixOptionsForm bind:options={myMix.options} />

			<div class="actions">
				<button
					type="button"
					class="primary"
					disabled={!myMix.ready || previewing}
					onclick={() => runPreview(false)}
				>
					{previewing ? 'Building the mix…' : 'Preview the mix'}
				</button>
				{#if preview}
					<button
						type="button"
						disabled={!myMix.ready || previewing}
						onclick={() => runPreview(true)}
					>
						Shuffle again
					</button>
				{/if}
				{#if !myMix.ready && myMix.ranking.length > 0}
					<span class="hint">Select at least {MIN_MIX_ARTISTS} artists.</span>
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
					<SaveDialog
						bind:name={playlistName}
						{trackUris}
						remember={previewRecipe ? { mode: 'me', recipe: previewRecipe } : undefined}
					/>
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

	.settings {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.slider {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	/* The two ends stay next to the slider, also on narrow screens. */
	.range {
		flex: 1 1 16rem;
		max-width: 28rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.range input {
		flex: 1;
		min-width: 0;
	}

	.end {
		color: var(--muted);
		font-size: 0.875rem;
	}

	.row,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	input[type='number'] {
		width: 4.5rem;
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
