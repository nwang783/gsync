import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JoinCodePanel from './JoinCodePanel.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('JoinCodePanel', () => {
  it('creates and reveals a join code for admins', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        teamId: 'team-123',
        joinCode: 'SP7E-YKDH-LPC3',
        role: 'member',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const user = {
      getIdToken: vi.fn().mockResolvedValue('token-123'),
    };

    render(<JoinCodePanel teamId="team-123" role="admin" user={user} seatName="Admin Seat" />);

    fireEvent.click(screen.getByRole('button', { name: /invite teammate|create join code/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/join-codes'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );

    expect(await screen.findByText('SP7E-YKDH-LPC3')).toBeInTheDocument();
  });
});
