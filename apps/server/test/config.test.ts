import { describe, expect, it } from 'bun:test';
import { ConfigError, loadConfig } from '../src/config';

const required = {
	SPOTIFY_CLIENT_ID: 'client-id',
	SPOTIFY_CLIENT_SECRET: 'client-secret-value',
	SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:5173/auth/callback',
	TOKEN_ENC_KEY: Buffer.alloc(32, 1).toString('base64')
};

function errorMessage(load: () => unknown): string {
	try {
		load();
	} catch (error) {
		return (error as Error).message;
	}
	return '';
}

describe('loadConfig', () => {
	it('uses local defaults for the optional values', () => {
		const config = loadConfig(required);

		expect(config).toMatchObject({
			NODE_ENV: 'development',
			HOST: '127.0.0.1',
			PORT: 3000,
			REDIS_URL: 'redis://127.0.0.1:6380',
			SPOTIFY_MARKET: 'US'
		});
		expect(config.STATIC_DIR).toBeUndefined();
	});

	it('takes the public origin and the cookie mode from the redirect URI', () => {
		expect(loadConfig(required)).toMatchObject({
			publicOrigin: 'http://127.0.0.1:5173',
			cookieSecure: false
		});
		expect(
			loadConfig({ ...required, SPOTIFY_REDIRECT_URI: 'https://mixer.example.com/auth/callback' })
		).toMatchObject({ publicOrigin: 'https://mixer.example.com', cookieSecure: true });
	});

	it('removes a trailing carriage return from Windows .env files', () => {
		const config = loadConfig({
			...required,
			PORT: '4000\r',
			REDIS_URL: 'redis://redis:6379\r',
			SPOTIFY_CLIENT_SECRET: 'client-secret-value\r'
		});

		expect(config.PORT).toBe(4000);
		expect(config.REDIS_URL).toBe('redis://redis:6379');
		expect(config.SPOTIFY_CLIENT_SECRET).toBe('client-secret-value');
	});

	it('requires the Spotify values and the encryption key', () => {
		const message = errorMessage(() => loadConfig({}));

		for (const name of Object.keys(required)) expect(message).toContain(name);
	});

	it('rejects an encryption key that is not 32 bytes', () => {
		const key = Buffer.alloc(16).toString('base64');

		expect(() => loadConfig({ ...required, TOKEN_ENC_KEY: key })).toThrow(ConfigError);
	});

	it('rejects a Redis URL with another protocol and a market that is not a country code', () => {
		expect(() => loadConfig({ ...required, REDIS_URL: 'http://127.0.0.1:6379' })).toThrow(
			ConfigError
		);
		expect(() => loadConfig({ ...required, SPOTIFY_MARKET: 'brazil' })).toThrow(ConfigError);
	});

	it('names the invalid variables but not their values', () => {
		const message = errorMessage(() =>
			loadConfig({ ...required, PORT: 'not-a-port-123', TOKEN_ENC_KEY: 'short-secret-value' })
		);

		expect(message).toContain('PORT');
		expect(message).toContain('TOKEN_ENC_KEY');
		expect(message).not.toContain('not-a-port-123');
		expect(message).not.toContain('short-secret-value');
	});
});
