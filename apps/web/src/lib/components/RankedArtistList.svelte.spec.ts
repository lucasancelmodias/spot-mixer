import type { RankedArtist } from '@spot-mixer/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import RankedArtistList from './RankedArtistList.svelte';

const artist = (n: number, followed = false): RankedArtist => ({
	id: `artist${n}`.padEnd(22, '0'),
	name: `Artist ${n}`,
	imageUrl: null,
	reasons: { topArtist: ['short_term'], topTracks: [], savedTracks: 0, recentPlays: 0, followed }
});

describe('RankedArtistList', () => {
	it('links each artist to Spotify and shows the reasons', () => {
		render(RankedArtistList, {
			artists: [artist(1, true), artist(2)],
			selected: [],
			full: false,
			ontoggle: () => {}
		});

		const link = screen.getByRole('link', { name: 'Artist 1' });
		expect(link.getAttribute('href')).toBe(`https://open.spotify.com/artist/${artist(1).id}`);
		expect(
			screen.getByText('In your top artists: last 4 weeks · You follow this artist')
		).toBeTruthy();
	});

	it('reports a toggle, and blocks new selections when the mix is full', async () => {
		const ontoggle = vi.fn();
		render(RankedArtistList, {
			artists: [artist(1), artist(2)],
			selected: [artist(1).id],
			full: true,
			ontoggle
		});

		const first = screen.getByRole('checkbox', { name: 'Include Artist 1' }) as HTMLInputElement;
		const second = screen.getByRole('checkbox', { name: 'Include Artist 2' }) as HTMLInputElement;
		await fireEvent.click(first);

		expect(ontoggle).toHaveBeenCalledWith(artist(1).id);
		expect(second.disabled).toBe(true);
	});
});
