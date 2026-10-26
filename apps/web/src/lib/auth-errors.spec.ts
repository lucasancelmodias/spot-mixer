import { AUTH_ERROR_CODES } from '@spot-mixer/shared';
import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

describe('authErrorMessage', () => {
	it('explains every code that the server sends', () => {
		for (const code of AUTH_ERROR_CODES) {
			expect(authErrorMessage(code)).not.toBe('The Spotify login failed. Try again.');
		}
	});

	it('has a general message for an unknown code', () => {
		expect(authErrorMessage('something_new')).toBe('The Spotify login failed. Try again.');
	});

	it('returns null without a code', () => {
		expect(authErrorMessage(null)).toBeNull();
	});
});
