import { z } from 'zod';

// A .env file saved on Windows can leave "\r" at the end of each value, so every value is trimmed.
const text = z.string().trim();

const envSchema = z.object({
	NODE_ENV: text.pipe(z.enum(['development', 'production', 'test'])).default('development'),
	HOST: text.min(1).default('127.0.0.1'),
	// Number() ignores surrounding whitespace, so "3000\r" also parses.
	PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
	// 6380 is the host port of the development Redis container (see compose.dev.yaml).
	REDIS_URL: text.pipe(z.url({ protocol: /^rediss?$/ })).default('redis://127.0.0.1:6380'),
	/** Folder with the built SPA. Set only in production, where the API also serves the web app. */
	STATIC_DIR: text.min(1).optional(),
	SPOTIFY_CLIENT_ID: text.min(1),
	SPOTIFY_CLIENT_SECRET: text.min(1),
	/** Must match a redirect URI in the Spotify Dashboard exactly. */
	SPOTIFY_REDIRECT_URI: text.pipe(z.url({ protocol: /^https?$/ })),
	/** ISO 3166-1 alpha-2 code for catalog reads (plan D7). */
	SPOTIFY_MARKET: text
		.regex(/^[A-Z]{2}$/, 'must be a two-letter country code, for example US')
		.default('US'),
	/** Spotify calls allowed for one request, for example one mix preview (plan §5.4). */
	SPOTIFY_CALL_BUDGET: z.coerce.number().int().min(10).max(500).default(60),
	/** 32 random bytes, base64. Encrypts the Spotify tokens in Redis. */
	TOKEN_ENC_KEY: text.refine(
		(value) => Buffer.from(value, 'base64').length === 32,
		'must be 32 random bytes encoded as base64'
	)
});

export type Config = z.infer<typeof envSchema> & {
	/** Origin of the app in the browser, taken from SPOTIFY_REDIRECT_URI. The Origin check uses it. */
	publicOrigin: string;
	/** True behind HTTPS: cookies then get Secure and the __Host- prefix. */
	cookieSecure: boolean;
};

export class ConfigError extends Error {}

/** Validates the environment. Error messages name the variables, never their values. */
export function loadConfig(env: Record<string, string | undefined>): Config {
	const result = envSchema.safeParse(env);
	if (!result.success) {
		const details = result.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		throw new ConfigError(`Invalid environment: ${details}`);
	}
	const publicOrigin = new URL(result.data.SPOTIFY_REDIRECT_URI).origin;
	return { ...result.data, publicOrigin, cookieSecure: publicOrigin.startsWith('https:') };
}
