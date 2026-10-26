import { describe, expect, it } from 'bun:test';
import { normalizeTitle } from '../src/mix/normalize';

describe('normalizeTitle', () => {
	it('gives versions of one song the same key', () => {
		const versions = [
			'Get Lucky',
			'Get Lucky (feat. Pharrell Williams & Nile Rodgers)',
			'Get Lucky - Radio Edit',
			'Get Lucky [Remastered 2023]',
			'Get Lucky feat. Pharrell Williams',
			'Get Lucky - Live'
		];

		expect(new Set(versions.map(normalizeTitle))).toEqual(new Set(['get lucky']));
	});

	it('removes accents and punctuation', () => {
		expect(normalizeTitle('Café Tacvba')).toBe('cafe tacvba');
		expect(normalizeTitle('Harder, Better, Faster, Stronger')).toBe(
			'harder better faster stronger'
		);
	});

	it('keeps brackets and dash parts that do not name a version', () => {
		expect(normalizeTitle('Song (Interlude)')).toBe('song interlude');
		expect(normalizeTitle('Re: Stacks - Part Two')).toBe('re stacks part two');
	});
});
