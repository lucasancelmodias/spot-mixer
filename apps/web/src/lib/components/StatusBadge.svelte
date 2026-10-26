<script lang="ts">
	type Status = 'checking' | 'up' | 'down';

	let { label, status }: { label: string; status: Status } = $props();
</script>

<span class="badge {status}" role="status">{label}: {status}</span>

<style>
	.badge {
		display: inline-block;
		margin-inline-end: 0.5rem;
		padding: 0.125rem 0.625rem;
		border: 1px solid currentColor;
		border-radius: 999px;
		font-size: 0.875rem;
	}

	.up {
		color: #1a7f37;
	}

	.down {
		color: #cf222e;
	}

	.checking {
		color: #6e7781;
	}
</style>
