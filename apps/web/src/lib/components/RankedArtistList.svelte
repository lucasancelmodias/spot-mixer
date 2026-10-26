<script lang="ts">
	import type { RankedArtist } from '@spot-mixer/shared';
	import { describeReasons } from '#lib/reasons.js';

	let {
		artists,
		selected,
		full,
		ontoggle
	}: {
		/** Best first. */
		artists: RankedArtist[];
		/** IDs of the selected artists. */
		selected: string[];
		/** True when no more artists can be selected. */
		full: boolean;
		ontoggle: (artistId: string) => void;
	} = $props();
</script>

<ol class="ranking">
	{#each artists as artist, index (artist.id)}
		{@const checked = selected.includes(artist.id)}
		<li class:checked>
			<input
				type="checkbox"
				aria-label="Include {artist.name}"
				{checked}
				disabled={!checked && full}
				onchange={() => ontoggle(artist.id)}
			/>
			<span class="number">{index + 1}</span>
			{#if artist.imageUrl}
				<img src={artist.imageUrl} alt="" width="48" height="48" />
			{:else}
				<span class="no-image" aria-hidden="true"></span>
			{/if}
			<div class="info">
				<a
					href="https://open.spotify.com/artist/{artist.id}"
					target="_blank"
					rel="noopener noreferrer"
				>
					{artist.name}
				</a>
				<small>{describeReasons(artist.reasons).join(' · ')}</small>
			</div>
		</li>
	{/each}
</ol>

<style>
	.ranking {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 28rem;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	li {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem 0.75rem;
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	li.checked {
		background: var(--surface);
	}

	.number {
		width: 2ch;
		text-align: right;
		color: var(--muted);
	}

	img,
	.no-image {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		box-sizing: border-box;
		border-radius: 4px;
		object-fit: contain;
		background: var(--surface);
	}

	/* Selected rows have the same background as the placeholder. */
	.no-image {
		border: 1px solid var(--border);
	}

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.info a {
		font-weight: 600;
		color: inherit;
	}

	small {
		color: var(--muted);
	}
</style>
