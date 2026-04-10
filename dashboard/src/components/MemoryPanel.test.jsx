import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotHandlers = [];

vi.mock('firebase/firestore', () => ({
  doc: (...parts) => ({ path: parts.join('/') }),
  onSnapshot: (_ref, onNext) => {
    snapshotHandlers.push(onNext);
    return () => {};
  },
}));

vi.mock('../firebase.js', () => ({
  db: {},
}));

import MemoryPanel from './MemoryPanel.jsx';

describe('MemoryPanel', () => {
  beforeEach(() => {
    snapshotHandlers.length = 0;
  });

  it('renders approved memory and drafts separately', async () => {
    render(<MemoryPanel teamId="team1" />);

    snapshotHandlers[0]({
      exists: () => true,
      data: () => ({
        approved: {
          companyBrief: { title: 'Company North Star' },
          projectBrief: { title: 'Project Lighthouse' },
          decisionCount: 2,
        },
        drafts: [
          { id: 'd1', title: 'Pricing options', state: 'draft' },
          { id: 'd2', title: 'Auth migration', state: 'approved', promotedTo: 'decisionLog' },
        ],
        status: {
          compiledState: 'fresh',
          compiledAt: new Date(),
        },
      }),
    });

    await waitFor(() => expect(screen.getByText(/approved strategy/i)).toBeInTheDocument());
    expect(screen.getByText(/planning evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing options/)).toBeInTheDocument();
    expect(screen.getByText(/state: fresh/i)).toBeInTheDocument();
  });

  it('shows empty state when memory summary is missing', async () => {
    render(<MemoryPanel teamId="team1" />);
    snapshotHandlers[0]({ exists: () => false });

    await waitFor(() => {
      expect(screen.getByText(/No memory summary yet/i)).toBeInTheDocument();
    });
  });
});
