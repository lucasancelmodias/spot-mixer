import type { MixTrack } from '@spot-mixer/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TrackList from './TrackList.svelte';

const track = (n: number, sourceArtistId: string): MixTrack => ({
	id: `track${n}`.padEnd(22, '0'),
	uri: `spotify:track:${`track${n}`.padEnd(22, '0')}`,
	name: `Song ${n}`,
	durationMs: 187_000,
	explicit: false,
	isPlayable: true,
	popularity: null,
	isrc: null,
	discNumber: 1,
	trackNumber: n,
	artists: [{ id: sourceArtistId, name: `Artist ${sourceArtistId}` }],
	album: { id: 'album', name: 'Album', albumType: 'album', releaseDate: '2020', imageUrl: null },
	sourceArtistId
});

describe('TrackList', () => {
	it('links each track to Spotify and shows its source artist and duration', () => {
		render(TrackList, {
			tracks: [track(1, 'a'), track(2, 'b')],
			sourceNames: { a: 'Daft Punk', b: 'Justice' },
			onremove: () => {},
			onmove: () => {}
		});

		const link = screen.getByRole('link', { name: 'Song 1' });
		expect(link.getAttribute('href')).toBe(`https://open.spotify.com/track/${track(1, 'a').id}`);
		expect(screen.getByText('Justice')).toBeTruthy();
		expect(screen.getAllByText('3:07')).toHaveLength(2);
	});

	it('tags the tracks of My Mix as familiar or discovery', () => {
		render(TrackList, {
			tracks: [
				{ ...track(1, 'a'), pool: 'familiar' },
				{ ...track(2, 'a'), pool: 'discovery' },
				track(3, 'b')
			],
			sourceNames: {},
			onremove: () => {},
			onmove: () => {}
		});

		expect(screen.getByText('Familiar').getAttribute('title')).toBe(
			'From your top or saved tracks'
		);
		expect(screen.getAllByText(/^(Familiar|Discovery)$/)).toHaveLength(2);
	});

	it('reports move and remove, and disables moves past the ends', async () => {
		const onremove = vi.fn();
		const onmove = vi.fn();
		render(TrackList, {
			tracks: [track(1, 'a'), track(2, 'b')],
			sourceNames: {},
			onremove,
			onmove
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Move Song 2 up' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Song 1' }));

		expect(onmove).toHaveBeenCalledWith(1, -1);
		expect(onremove).toHaveBeenCalledWith(0);
		expect(screen.getByRole('button', { name: 'Move Song 1 up' }).hasAttribute('disabled')).toBe(
			true
		);
		expect(screen.getByRole('button', { name: 'Move Song 2 down' }).hasAttribute('disabled')).toBe(
			true
		);
	});
});
