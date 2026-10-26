const IV_BYTES = 12;

/**
 * Encrypts tokens at rest with AES-256-GCM (WebCrypto).
 * Format: base64url(iv) + "." + base64url(ciphertext and auth tag).
 */
export class TokenCipher {
	private constructor(private readonly key: CryptoKey) {}

	/** `base64Key` must decode to exactly 32 bytes (TOKEN_ENC_KEY). */
	static async fromBase64Key(base64Key: string): Promise<TokenCipher> {
		const raw = new Uint8Array(Buffer.from(base64Key, 'base64'));
		if (raw.length !== 32) throw new Error('TOKEN_ENC_KEY must decode to 32 bytes');
		const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
		return new TokenCipher(key);
	}

	async encrypt(plaintext: string): Promise<string> {
		const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
		const data = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv },
			this.key,
			new TextEncoder().encode(plaintext)
		);
		return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(data))}`;
	}

	/** Throws when the payload was changed or was encrypted with another key. */
	async decrypt(payload: string): Promise<string> {
		const [ivPart, dataPart] = payload.split('.');
		if (!ivPart || !dataPart) throw new Error('The encrypted token is malformed');
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromBase64Url(ivPart) },
			this.key,
			fromBase64Url(dataPart)
		);
		return new TextDecoder().decode(plaintext);
	}
}

function toBase64Url(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64url');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
	return new Uint8Array(Buffer.from(text, 'base64url'));
}
