import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
	it('shows the label and the status', () => {
		render(StatusBadge, { label: 'Redis', status: 'down' });

		const badge = screen.getByRole('status');
		expect(badge.textContent).toBe('Redis: down');
		expect(badge.classList.contains('down')).toBe(true);
	});
});
