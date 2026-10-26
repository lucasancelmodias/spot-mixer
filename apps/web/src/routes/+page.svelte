<script lang="ts">
	import { getHealth } from '#lib/api.js';
	import StatusBadge from '#lib/components/StatusBadge.svelte';

	const health = getHealth();
</script>

<main>
	<h1>spot-mixer</h1>
	<p>Mix two or more artists into one Spotify playlist.</p>

	<section aria-label="Service status">
		{#await health}
			<StatusBadge label="API" status="checking" />
		{:then result}
			<StatusBadge label="API" status="up" />
			<StatusBadge label="Redis" status={result.redis} />
		{:catch}
			<StatusBadge label="API" status="down" />
		{/await}
	</section>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}
</style>
