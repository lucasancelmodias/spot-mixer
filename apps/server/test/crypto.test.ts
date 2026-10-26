import { describe, expect, it } from 'bun:test';
import { TokenCipher } from '../src/session/crypto';
import { TEST_ENC_KEY } from './support/fakes';

describe('TokenCipher', () => {
	it('decrypts what it encrypted, and the payload does not show the plaintext', async () => {
		const cipher = await TokenCipher.fromBase64Key(TEST_ENC_KEY);

		const sealed = await cipher.encrypt('access-token-value');

		expect(sealed).not.toContain('access-token-value');
		expect(await cipher.decrypt(sealed)).toBe('access-token-value');
	});

	it('uses a new IV for every encryption', async () => {
		const cipher = await TokenCipher.fromBase64Key(TEST_ENC_KEY);

		expect(await cipher.encrypt('same')).not.toBe(await cipher.encrypt('same'));
	});

	it('rejects a changed payload', async () => {
		const cipher = await TokenCipher.fromBase64Key(TEST_ENC_KEY);
		const [iv, data] = (await cipher.encrypt('value')).split('.');
		const bytes = Buffer.from(data ?? '', 'base64url');
		bytes[0] = (bytes[0] ?? 0) ^ 1;

		await expect(cipher.decrypt(`${iv}.${bytes.toString('base64url')}`)).rejects.toThrow();
	});

	it('rejects a payload from another key', async () => {
		const other = await TokenCipher.fromBase64Key(Buffer.alloc(32, 9).toString('base64'));
		const cipher = await TokenCipher.fromBase64Key(TEST_ENC_KEY);

		await expect(cipher.decrypt(await other.encrypt('value'))).rejects.toThrow();
	});

	it('requires a 32-byte key', async () => {
		const shortKey = Buffer.alloc(16).toString('base64');

		await expect(TokenCipher.fromBase64Key(shortKey)).rejects.toThrow('32 bytes');
	});
});
