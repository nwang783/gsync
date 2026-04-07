import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotCallbacks = [];
const getDocMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...parts) => ({ path: parts.join('/') }),
  onSnapshot: (_ref, onNext) => {
    snapshotCallbacks.push(onNext);
    return () => {};
  },
  getDoc: (...args) => getDocMock(...args),
}));

vi.mock('../firebase.js', () => ({
  db: {},
}));

import PlanDetail from './PlanDetail.jsx';

describe('PlanDetail', () => {
  beforeEach(() => {
    snapshotCallbacks.length = 0;
    getDocMock.mockReset();
  });

  it('loads canonical markdown lazily after summary snapshot renders', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ markdown: '# Canonical Plan\n\nBody copy.', revision: 2 }),
    });

    render(<PlanDetail planId="plan1" teamId="team1" onClose={() => {}} />);

    snapshotCallbacks[0]({
      exists: () => true,
      id: 'plan1',
      data: () => ({
        author: 'Nathan',
        status: 'in-progress',
        summary: 'Summaries first',
        alignment: 'Ship sync',
        outOfScope: 'History',
        touches: ['src/cli.js'],
        createdAt: new Date(),
        updatedAt: new Date(),
        updates: [],
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Canonical Plan')).toBeInTheDocument();
    });

    expect(await screen.findByText((content) => content.includes('# Canonical Plan') && content.includes('Body copy.'))).toBeInTheDocument();
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });
});
