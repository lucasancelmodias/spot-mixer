<script lang="ts">
	import { getHealth, getMe, logout } from '#lib/api.js';
	import { authErrorMessage } from '#lib/auth-errors.js';
	import StatusBadge from '#lib/components/StatusBadge.svelte';

	const health = getHealth();
	const me = getMe();
	const authError = authErrorMessage(new URLSearchParams(location.search).get('auth_error'));

	let loggingOut = $state(false);
	let logoutError = $state<string | null>(null);

	async function signOut() {
		loggingOut = true;
		logoutError = null;
		try {
			await logout();
			location.assign('/');
		} catch {
			logoutError = 'The logout failed. Try again.';
			loggingOut = false;
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' });
	}
</script>

<main>
	<h1>spot-mixer</h1>
	<p>Mix two or more artists into one Spotify playlist.</p>

	{#if authError}
		<p class="error" role="alert">{authError}</p>
	{/if}

	{#await me}
		<p>Checking your session…</p>
	{:then user}
		{#if user}
			<section class="account" aria-label="Spotify account">
				{#if user.imageUrl}
					<img src={user.imageUrl} alt="" width="48" height="48" />
				{/if}
				<div>
					<p>Signed in with Spotify as <strong>{user.displayName ?? user.id}</strong>.</p>
					<p class="hint">
						Spotify access ends on {formatDate(user.renewBy)}. Sign in again before that date.
					</p>
				</div>
				<button type="button" onclick={signOut} disabled={loggingOut}>Log out</button>
			</section>
			{#if logoutError}
				<p class="error" role="alert">{logoutError}</p>
			{/if}
		{:else}
			<!-- /auth/login is an API route, not a SvelteKit route: it needs a full page load, and resolve() does not apply. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="connect" href="/auth/login" data-sveltekit-reload>Connect with Spotify</a>
		{/if}
	{:catch}
		<p class="error" role="alert">The app could not read your session. Reload the page.</p>
	{/await}

	<section class="status" aria-label="Service status">
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

	.account {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.account img {
		border-radius: 50%;
	}

	.account p {
		margin: 0.25rem 0;
	}

	.hint {
		color: #57606a;
		font-size: 0.875rem;
	}

	.connect {
		display: inline-block;
		padding: 0.625rem 1.25rem;
		border-radius: 999px;
		background: #1db954;
		color: #000;
		font-weight: 600;
		text-decoration: none;
	}

	.error {
		color: #cf222e;
	}

	.status {
		margin-top: 2rem;
	}
</style>
