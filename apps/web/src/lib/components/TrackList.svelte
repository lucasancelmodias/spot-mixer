<script lang="ts">
	import type { MixTrack } from '@spot-mixer/shared';
	import { formatDuration } from '#lib/format.js';

	let {
		tracks,
		sourceNames,
		onremove,
		onmove
	}: {
		tracks: MixTrack[];
		/** Bucket artist ID → name. */
		sourceNames: Record<string, string>;
		onremove: (index: number) => void;
		onmove: (index: number, delta: -1 | 1) => void;
	} = $props();
</script>

<ol class="tracks">
	{#each tracks as track, index (track.id)}
		<li>
			<span class="number">{index + 1}</span>
			{#if track.album.imageUrl}
				<img src={track.album.imageUrl} alt="" width="48" height="48" />
			{/if}
			<div class="info">
				<a
					href="https://open.spotify.com/track/{track.id}"
					target="_blank"
					rel="noopener noreferrer"
				>
					{track.name}
				</a>
				<small>
					{track.artists.map((artist) => artist.name).join(', ')} · {track.album.name}
				</small>
			</div>
			<span class="source" title="Source artist">{sourceNames[track.sourceArtistId] ?? ''}</span>
			<span class="duration">{formatDuration(track.durationMs)}</span>
			<span class="actions">
				<button
					type="button"
					aria-label="Move {track.name} up"
					disabled={index === 0}
					onclick={() => onmove(index, -1)}>↑</button
				>
				<button
					type="button"
					aria-label="Move {track.name} down"
					disabled={index === tracks.length - 1}
					onclick={() => onmove(index, 1)}>↓</button
				>
				<button type="button" aria-label="Remove {track.name}" onclick={() => onremove(index)}
					>✕</button
				>
			</span>
		</li>
	{/each}
</ol>

<style>
	.tracks {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.375rem 0;
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	.number {
		width: 2ch;
		text-align: right;
		color: var(--muted);
	}

	img {
		border-radius: 4px;
		object-fit: contain;
	}

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.info a {
		color: inherit;
	}

	.info small,
	.source,
	.duration {
		color: var(--muted);
		font-size: 0.875rem;
	}

	.info small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		gap: 0.25rem;
	}

	.actions button {
		min-width: 2rem;
	}

	@media (max-width: 40rem) {
		.source {
			display: none;
		}
	}
</style>
