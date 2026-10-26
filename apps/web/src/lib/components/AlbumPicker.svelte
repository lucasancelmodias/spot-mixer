<script lang="ts">
	import type { AlbumSummary } from '@spot-mixer/shared';
	import { MAX_ALBUMS_PER_SOURCE } from '@spot-mixer/shared/limits';
	import { getArtistReleases } from '#lib/api.js';
	import type { AlbumChoice } from '#lib/bucket.svelte.js';
	import { describeError } from '#lib/errors.js';
	import { releaseYear } from '#lib/format.js';

	let {
		artistId,
		selected,
		onchange
	}: {
		artistId: string;
		selected: AlbumChoice[];
		onchange: (albums: AlbumChoice[]) => void;
	} = $props();

	const releases = $derived(getArtistReleases(artistId));

	function isSelected(album: AlbumSummary): boolean {
		return selected.some((choice) => choice.id === album.id);
	}

	function toggle(album: AlbumSummary) {
		onchange(
			isSelected(album)
				? selected.filter((choice) => choice.id !== album.id)
				: [...selected, { id: album.id, name: album.name }].slice(0, MAX_ALBUMS_PER_SOURCE)
		);
	}
</script>

{#await releases}
	<p class="hint">Loading the releases…</p>
{:then albums}
	{#if albums.length === 0}
		<p class="hint">Spotify has no albums or singles for this artist.</p>
	{:else}
		<p class="hint">Select up to {MAX_ALBUMS_PER_SOURCE} albums or singles.</p>
		<ul class="albums">
			{#each albums as album (album.id)}
				{@const checked = isSelected(album)}
				<li>
					<label class:checked>
						<input
							type="checkbox"
							{checked}
							disabled={!checked && selected.length >= MAX_ALBUMS_PER_SOURCE}
							onchange={() => toggle(album)}
						/>
						{#if album.imageUrl}
							<img src={album.imageUrl} alt="" width="56" height="56" />
						{/if}
						<span>
							{album.name}
							<small>
								{album.albumType} · {releaseYear(album.releaseDate)}{album.totalTracks
									? ` · ${album.totalTracks} tracks`
									: ''}
							</small>
						</span>
					</label>
				</li>
			{/each}
		</ul>
	{/if}
{:catch error}
	<p class="error" role="alert">{describeError(error)}</p>
{/await}

<style>
	.albums {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.5rem;
		max-height: 22rem;
		overflow-y: auto;
	}

	label {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.375rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
	}

	label.checked {
		border-color: var(--accent);
	}

	img {
		width: 56px;
		height: 56px;
		border-radius: 4px;
		object-fit: contain;
	}

	span {
		display: flex;
		flex-direction: column;
		font-size: 0.875rem;
	}

	small {
		color: var(--muted);
	}
</style>
