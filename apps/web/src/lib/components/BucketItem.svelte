<script lang="ts">
	import { MAX_SOURCE_COUNT } from '@spot-mixer/shared/limits';
	import {
		type BucketEntry,
		type BucketSource,
		clampCount,
		DEFAULT_COUNT
	} from '#lib/bucket.svelte.js';
	import AlbumPicker from './AlbumPicker.svelte';

	let {
		entry,
		onremove,
		onchange
	}: {
		entry: BucketEntry;
		onremove: () => void;
		onchange: (source: BucketSource) => void;
	} = $props();

	let pickerOpen = $state(false);
	const id = $derived(entry.artist.id);

	function setKind(kind: BucketSource['kind']) {
		const source = entry.source;
		if (kind === 'albums') {
			onchange({ kind: 'albums', albums: [], randomPerAlbum: null });
			pickerOpen = true;
			return;
		}
		onchange({ kind, count: source.kind === 'albums' ? DEFAULT_COUNT : source.count });
	}

	function setCount(value: number) {
		const source = entry.source;
		if (source.kind !== 'albums') onchange({ kind: source.kind, count: clampCount(value) });
	}

	function setPerAlbum(value: string) {
		const source = entry.source;
		if (source.kind === 'albums') {
			onchange({ ...source, randomPerAlbum: value === 'all' ? null : Number(value) });
		}
	}
</script>

<li class="entry">
	<header>
		{#if entry.artist.imageUrl}
			<img src={entry.artist.imageUrl} alt="" width="48" height="48" />
		{/if}
		<a href="https://open.spotify.com/artist/{id}" target="_blank" rel="noopener noreferrer">
			{entry.artist.name}
		</a>
		<button type="button" class="link" onclick={onremove}>Remove</button>
	</header>

	<fieldset>
		<legend>Tracks from</legend>
		<label>
			<input
				type="radio"
				name="kind-{id}"
				checked={entry.source.kind === 'popular'}
				onchange={() => setKind('popular')}
			/>
			Popular
		</label>
		<label>
			<input
				type="radio"
				name="kind-{id}"
				checked={entry.source.kind === 'favorites'}
				onchange={() => setKind('favorites')}
			/>
			Your favorites
		</label>
		<label>
			<input
				type="radio"
				name="kind-{id}"
				checked={entry.source.kind === 'albums'}
				onchange={() => setKind('albums')}
			/>
			Albums
		</label>
	</fieldset>

	{#if entry.source.kind === 'albums'}
		<p class="hint">
			{entry.source.albums.length === 0
				? 'No album selected.'
				: `Selected: ${entry.source.albums.map((album) => album.name).join(', ')}`}
		</p>
		<div class="row">
			<button type="button" onclick={() => (pickerOpen = !pickerOpen)}>
				{pickerOpen ? 'Close the album list' : 'Choose albums'}
			</button>
			<label>
				Tracks per album
				<select
					value={entry.source.randomPerAlbum === null ? 'all' : String(entry.source.randomPerAlbum)}
					onchange={(event) => setPerAlbum(event.currentTarget.value)}
				>
					<option value="all">All</option>
					{#each [1, 2, 3, 5] as count (count)}
						<option value={String(count)}>{count} at random</option>
					{/each}
				</select>
			</label>
		</div>
		{#if pickerOpen}
			{@const source = entry.source}
			<AlbumPicker
				artistId={id}
				selected={source.albums}
				onchange={(albums) => onchange({ ...source, albums })}
			/>
		{/if}
	{:else}
		<label class="row">
			Number of tracks
			<input
				type="number"
				min="1"
				max={MAX_SOURCE_COUNT}
				value={entry.source.count}
				onchange={(event) => setCount(event.currentTarget.valueAsNumber)}
			/>
		</label>
		{#if entry.source.kind === 'favorites'}
			<p class="hint">Your own top tracks by this artist, from your Spotify listening.</p>
		{/if}
	{/if}
</li>

<style>
	.entry {
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	header {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	header a {
		flex: 1;
		font-weight: 600;
		color: inherit;
	}

	header img {
		border-radius: 4px;
		object-fit: contain;
	}

	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 0.75rem 0 0.5rem;
		padding: 0;
		border: 0;
	}

	legend {
		float: left;
		color: var(--muted);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	input[type='number'] {
		width: 4.5rem;
	}
</style>
