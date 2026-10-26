import { describe, expect, it } from 'bun:test';
import { ConfigError, loadConfig } from '../src/config';

describe('loadConfig', () => {
	it('uses local defaults for an empty environment', () => {
		expect(loadConfig({})).toEqual({
			NODE_ENV: 'development',
			HOST: '127.0.0.1',
			PORT: 3000,
			REDIS_URL: 'redis://127.0.0.1:6380'
		});
	});

	it('removes a trailing carriage return from Windows .env files', () => {
		const config = loadConfig({ PORT: '4000\r', REDIS_URL: 'redis://redis:6379\r' });

		expect(config.PORT).toBe(4000);
		expect(config.REDIS_URL).toBe('redis://redis:6379');
	});

	it('rejects a Redis URL with another protocol', () => {
		expect(() => loadConfig({ REDIS_URL: 'http://127.0.0.1:6379' })).toThrow(ConfigError);
	});

	it('names the invalid variable but not its value', () => {
		let message = '';
		try {
			loadConfig({ PORT: 'not-a-port-123' });
		} catch (error) {
			message = (error as Error).message;
		}

		expect(message).toContain('PORT');
		expect(message).not.toContain('not-a-port-123');
	});
});
