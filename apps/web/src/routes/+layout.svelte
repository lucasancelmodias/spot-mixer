<script lang="ts">
	import { resolve } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>spot-mixer</title>
</svelte:head>

<header class="site">
	<a class="brand" href={resolve('/')}>spot-mixer</a>
	<nav>
		<a href={resolve('/mix/artists')}>Artist Mix</a>
		<a href={resolve('/mix/me')}>My Mix</a>
		<a href={resolve('/mixes')}>Saved mixes</a>
	</nav>
</header>

{@render children()}

<footer class="site">
	<p>Artist, album and track data and cover art come from Spotify. Each item links to Spotify.</p>
</footer>

<style>
	:global(:root) {
		color-scheme: light dark;
		--bg: #ffffff;
		--fg: #1f2328;
		--muted: #57606a;
		--border: #d0d7de;
		--surface: #f6f8fa;
		--accent: #1db954;
		--accent-fg: #000000;
		--danger: #cf222e;
		--warning: #9a6700;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--bg: #0d1117;
			--fg: #e6edf3;
			--muted: #8b949e;
			--border: #30363d;
			--surface: #161b22;
			--danger: #ff7b72;
			--warning: #d29922;
		}
	}

	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
		line-height: 1.5;
		background: var(--bg);
		color: var(--fg);
	}

	:global(button),
	:global(input),
	:global(select) {
		font: inherit;
		color: inherit;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.375rem 0.75rem;
	}

	:global(button) {
		cursor: pointer;
		background: var(--surface);
	}

	:global(button:disabled) {
		cursor: not-allowed;
		opacity: 0.6;
	}

	:global(button.primary) {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
		font-weight: 600;
	}

	:global(button.link) {
		background: none;
		border: none;
		color: var(--muted);
		text-decoration: underline;
		padding: 0;
	}

	:global(input[type='checkbox']),
	:global(input[type='radio']) {
		padding: 0;
	}

	:global(.hint) {
		color: var(--muted);
		font-size: 0.875rem;
	}

	:global(.error) {
		color: var(--danger);
	}

	:global(a.connect) {
		display: inline-block;
		align-self: flex-start;
		padding: 0.625rem 1.25rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-fg);
		font-weight: 600;
		text-decoration: none;
	}

	header.site,
	footer.site {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		gap: 1.5rem;
		align-items: center;
	}

	header.site a {
		color: inherit;
	}

	header.site nav {
		display: flex;
		gap: 1rem;
	}

	.brand {
		font-weight: 700;
		text-decoration: none;
	}

	footer.site {
		color: var(--muted);
		font-size: 0.875rem;
		border-top: 1px solid var(--border);
	}
</style>
