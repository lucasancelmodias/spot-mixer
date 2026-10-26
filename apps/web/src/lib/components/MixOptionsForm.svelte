<script lang="ts">
	import type { MixOptions } from '@spot-mixer/shared';
	import { EXCLUDE_OPTIONS, MAX_MIX_TRACKS, ORDER_OPTIONS } from '@spot-mixer/shared/limits';

	let { options = $bindable() }: { options: MixOptions } = $props();

	const ORDER_LABELS: Record<MixOptions['order'], string> = {
		'balanced-shuffle': 'Shuffle, with the artists spread out',
		'round-robin': 'Take turns: A, B, C, A, B, C',
		grouped: 'Grouped by artist',
		chronological: 'By release date'
	};

	const EXCLUDE_LABELS: Record<MixOptions['exclude'][number], string> = {
		explicit: 'Explicit',
		live: 'Live',
		remix: 'Remixes',
		acoustic: 'Acoustic',
		instrumental: 'Instrumental',
		demo: 'Demos'
	};

	function setExcluded(option: MixOptions['exclude'][number], excluded: boolean) {
		options.exclude = excluded
			? [...options.exclude, option]
			: options.exclude.filter((value) => value !== option);
	}

	function setMaxTracks(value: string) {
		const number = Number(value);
		options.maxTracks =
			value.trim() === '' || !Number.isFinite(number)
				? null
				: Math.min(MAX_MIX_TRACKS, Math.max(1, Math.round(number)));
	}
</script>

<fieldset class="options">
	<legend>Mix options</legend>

	<label>
		Order
		<select bind:value={options.order}>
			{#each ORDER_OPTIONS as order (order)}
				<option value={order}>{ORDER_LABELS[order]}</option>
			{/each}
		</select>
	</label>

	<label>
		<input type="checkbox" bind:checked={options.noAdjacentSameArtist} />
		Never play two tracks of one artist in a row
	</label>

	<div class="exclude">
		<span>Leave out:</span>
		{#each EXCLUDE_OPTIONS as option (option)}
			<label>
				<input
					type="checkbox"
					checked={options.exclude.includes(option)}
					onchange={(event) => setExcluded(option, event.currentTarget.checked)}
				/>
				{EXCLUDE_LABELS[option]}
			</label>
		{/each}
	</div>

	<label>
		Maximum number of tracks
		<input
			type="number"
			min="1"
			max={MAX_MIX_TRACKS}
			placeholder="No limit"
			value={options.maxTracks ?? ''}
			onchange={(event) => setMaxTracks(event.currentTarget.value)}
		/>
	</label>
</fieldset>

<style>
	.options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.exclude {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	input[type='number'] {
		width: 6rem;
	}
</style>
