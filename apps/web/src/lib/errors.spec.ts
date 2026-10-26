import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { describeError } from './errors';

describe('describeError', () => {
	it('tells the user when Spotify calls are paused', () => {
		const message = describeError(
			new ApiError(503, 'spotify_unavailable', { until: '2026-10-26T15:30:00.000Z' })
		);

		expect(message).toContain('Spotify calls are paused until');
	});

	it('explains a request that needs too many Spotify calls', () => {
		expect(describeError(new ApiError(422, 'too_many_calls'))).toContain('fewer artists');
	});

	it('names an incomplete save with the number of added tracks', () => {
		expect(describeError(new ApiError(502, 'save_incomplete', { added: 100 }))).toContain(
			'added only 100 tracks'
		);
	});

	it('lists validation problems and handles network errors', () => {
		expect(
			describeError(new ApiError(400, 'invalid_request', { issues: ['sources: too small'] }))
		).toBe('The mix settings are not valid. sources: too small');
		expect(describeError(new TypeError('Failed to fetch'))).toContain('could not reach');
	});
});
