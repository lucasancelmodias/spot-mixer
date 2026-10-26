import { z } from 'zod';
import type { FetchLike } from '../lib/http';
import { InvalidGrantError, SpotifyError } from './errors';

const ACCOUNTS_URL = 'https://accounts.spotify.com';

/** Scopes of the MVP features (plan §5.2). Ask for more only when a feature that needs them ships. */
export const MVP_SCOPES = [
	'playlist-modify-private',
	'user-top-read',
	'user-read-recently-played',
	'user-follow-read',
	'user-library-read'
] as const;

export type TokenSet = {
	accessToken: string;
	/** Null when Spotify sent no refresh token. After a refresh, keep the old one. */
	refreshToken: string | null;
	expiresAt: number;
	scopes: string[];
};

const tokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.number().positive(),
	scope: z.string().optional(),
	refresh_token: z.string().min(1).optional()
});

const tokenErrorSchema = z.object({ error: z.string() });

export type OAuthOptions = {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	fetch: FetchLike;
	now: () => number;
};

/** Calls to the Spotify Accounts service: the authorize URL and the token endpoint. */
export class SpotifyOAuth {
	constructor(private readonly options: OAuthOptions) {}

	authorizeUrl(state: string, scopes: readonly string[]): string {
		const url = new URL('/authorize', ACCOUNTS_URL);
		url.search = new URLSearchParams({
			response_type: 'code',
			client_id: this.options.clientId,
			redirect_uri: this.options.redirectUri,
			scope: scopes.join(' '),
			state
		}).toString();
		return url.toString();
	}

	exchangeCode(code: string): Promise<TokenSet> {
		return this.requestToken({
			grant_type: 'authorization_code',
			code,
			redirect_uri: this.options.redirectUri
		});
	}

	/** Throws InvalidGrantError when the refresh token expired or was revoked. */
	refresh(refreshToken: string): Promise<TokenSet> {
		return this.requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
	}

	clientCredentials(): Promise<TokenSet> {
		return this.requestToken({ grant_type: 'client_credentials' });
	}

	private async requestToken(params: Record<string, string>): Promise<TokenSet> {
		const { clientId, clientSecret } = this.options;
		const res = await this.options.fetch(`${ACCOUNTS_URL}/api/token`, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams(params).toString(),
			signal: AbortSignal.timeout(10_000)
		});
		const body: unknown = await res.json().catch(() => null);
		if (!res.ok) {
			const parsed = tokenErrorSchema.safeParse(body);
			const code = parsed.success ? parsed.data.error : `http_${res.status}`;
			if (code === 'invalid_grant' && params.grant_type === 'refresh_token') {
				throw new InvalidGrantError();
			}
			// Only the error code goes into the message. It is safe to log.
			throw new SpotifyError(`Spotify token request failed: ${code}`, res.status);
		}
		const data = tokenResponseSchema.parse(body);
		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token ?? null,
			expiresAt: this.options.now() + data.expires_in * 1000,
			scopes: data.scope?.split(' ').filter(Boolean) ?? []
		};
	}
}
