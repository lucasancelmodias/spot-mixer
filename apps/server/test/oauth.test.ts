import { describe, expect, it } from 'bun:test';
import { InvalidGrantError, SpotifyError } from '../src/spotify/errors';
import { MVP_SCOPES, SpotifyOAuth } from '../src/spotify/oauth';
import { type FetchHandler, fakeFetch, formOf, headerOf, json } from './support/fakes';

const NOW = Date.UTC(2026, 9, 26, 12);
const REDIRECT_URI = 'http://127.0.0.1:5173/auth/callback';

function setup(handler: FetchHandler) {
	const { fetch, calls } = fakeFetch(handler);
	const oauth = new SpotifyOAuth({
		clientId: 'client-id',
		clientSecret: 'client-secret',
		redirectUri: REDIRECT_URI,
		fetch,
		now: () => NOW
	});
	return { oauth, calls };
}

describe('SpotifyOAuth', () => {
	it('builds the authorize URL', () => {
		const { oauth } = setup(() => json({}));

		const url = new URL(oauth.authorizeUrl('state-1', MVP_SCOPES));

		expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			response_type: 'code',
			client_id: 'client-id',
			redirect_uri: REDIRECT_URI,
			scope: MVP_SCOPES.join(' '),
			state: 'state-1'
		});
	});

	it('exchanges a code with client authentication', async () => {
		const { oauth, calls } = setup(() =>
			json({
				access_token: 'at',
				token_type: 'Bearer',
				expires_in: 3600,
				refresh_token: 'rt',
				scope: 'user-top-read playlist-modify-private'
			})
		);

		const tokens = await oauth.exchangeCode('code-1');

		expect(tokens).toEqual({
			accessToken: 'at',
			refreshToken: 'rt',
			expiresAt: NOW + 3_600_000,
			scopes: ['user-top-read', 'playlist-modify-private']
		});
		const call = calls[0];
		expect(call?.url.toString()).toBe('https://accounts.spotify.com/api/token');
		expect(call?.init?.method).toBe('POST');
		expect(headerOf(call?.init, 'Authorization')).toBe(`Basic ${btoa('client-id:client-secret')}`);
		expect(Object.fromEntries(formOf(call?.init))).toEqual({
			grant_type: 'authorization_code',
			code: 'code-1',
			redirect_uri: REDIRECT_URI
		});
	});

	it('returns a null refresh token when a refresh response has none', async () => {
		const { oauth, calls } = setup(() =>
			json({ access_token: 'at-2', token_type: 'Bearer', expires_in: 3600 })
		);

		const tokens = await oauth.refresh('rt-1');

		expect(tokens.refreshToken).toBeNull();
		expect(Object.fromEntries(formOf(calls[0]?.init))).toEqual({
			grant_type: 'refresh_token',
			refresh_token: 'rt-1'
		});
	});

	it('throws InvalidGrantError when the refresh token is no longer valid', async () => {
		const { oauth } = setup(() =>
			json({ error: 'invalid_grant', error_description: 'Refresh token revoked' }, 400)
		);

		await expect(oauth.refresh('rt-1')).rejects.toBeInstanceOf(InvalidGrantError);
	});

	it('reports a failed code exchange by its error code only', async () => {
		const { oauth } = setup(() =>
			json({ error: 'invalid_grant', error_description: 'Invalid authorization code' }, 400)
		);

		const error = await oauth.exchangeCode('code-1').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(SpotifyError);
		expect(error).not.toBeInstanceOf(InvalidGrantError);
		expect((error as Error).message).toBe('Spotify token request failed: invalid_grant');
	});

	it('gets a Client Credentials token', async () => {
		const { oauth, calls } = setup(() =>
			json({ access_token: 'app-token', token_type: 'Bearer', expires_in: 3600 })
		);

		expect((await oauth.clientCredentials()).accessToken).toBe('app-token');
		expect(formOf(calls[0]?.init).get('grant_type')).toBe('client_credentials');
	});
});
