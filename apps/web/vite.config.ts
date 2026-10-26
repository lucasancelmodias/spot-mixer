import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

// The Bun API. In development, Vite forwards API and OAuth requests to it.
const apiOrigin = 'http://127.0.0.1:3000';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA mode: the API serves index.html for every path that is not a file.
			adapter: adapter({ fallback: 'index.html' })
		}),
		svelteTesting()
	],
	server: {
		// Spotify accepts HTTP redirect URIs only on loopback IPs, and cookies set on
		// 127.0.0.1 do not reach localhost. Keep the dev site on 127.0.0.1.
		host: '127.0.0.1',
		port: 5173,
		strictPort: true,
		proxy: { '^/(api|auth)/': apiOrigin }
	},
	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		expect: { requireAssertions: true }
	}
});
