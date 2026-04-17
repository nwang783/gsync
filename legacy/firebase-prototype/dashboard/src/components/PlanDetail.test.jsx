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
      expect(screen.getByRole('heading', { name: 'Canonical Plan' })).toBeInTheDocument();
    });

    expect(screen.getByText('Body copy.')).toBeInTheDocument();
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });

  it('does not keep showing the previous plan while switching to a new plan', async () => {
    getDocMock.mockImplementation((ref) => {
      if (ref.path.includes('/plan-1/content/current')) {
        return Promise.resolve({
          exists: () => true,
          data: () => ({ markdown: '# Plan One\n\nOld body.', revision: 1 }),
        });
      }

      if (ref.path.includes('/plan-2/content/current')) {
        return Promise.resolve({
          exists: () => true,
          data: () => ({ markdown: '# Plan Two\n\nFresh body.', revision: 1 }),
        });
      }

      return Promise.resolve({
        exists: () => false,
        data: () => ({}),
      });
    });

    const { rerender } = render(<PlanDetail planId="plan-1" teamId="team1" onClose={() => {}} />);

    snapshotCallbacks[0]({
      exists: () => true,
      id: 'plan-1',
      data: () => ({
        author: 'Nathan',
        status: 'in-progress',
        summary: 'Plan one summary',
        alignment: 'Ship sync',
        outOfScope: 'History',
        touches: ['src/cli.js'],
        createdAt: new Date(),
        updatedAt: new Date(),
        updates: [],
      }),
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Plan One' })).toBeInTheDocument();
    });

    rerender(<PlanDetail planId="plan-2" teamId="team1" onClose={() => {}} />);

    expect(screen.getByText('Loading plan...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Plan One' })).not.toBeInTheDocument();

    snapshotCallbacks[1]({
      exists: () => true,
      id: 'plan-2',
      data: () => ({
        author: 'Nathan',
        status: 'in-progress',
        summary: 'Plan two summary',
        alignment: 'Ship sync',
        outOfScope: 'History',
        touches: ['src/firestore.js'],
        createdAt: new Date(),
        updatedAt: new Date(),
        updates: [],
      }),
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Plan Two' })).toBeInTheDocument();
    });
  });
});
