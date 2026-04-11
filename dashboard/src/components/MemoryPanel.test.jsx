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

    await waitFor(() => expect(screen.getByRole('button', { name: /company brief/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /project brief/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^decisions$/i })).toBeInTheDocument();
    expect(screen.getByText(/open drafts/i)).toBeInTheDocument();
    expect(screen.getByText(/project lighthouse/i)).toBeInTheDocument();
    expect(screen.getByText(/^1$/)).toBeInTheDocument();
    expect(screen.getByText(/fresh/i)).toBeInTheDocument();
  });

  it('marks the compiled context pack as needing sync after memory changes', async () => {
    render(<MemoryPanel teamId="team1" />);

    snapshotHandlers[0]({
      exists: () => true,
      data: () => ({
        approved: {
          companyBrief: { title: 'Company North Star' },
          projectBrief: { title: 'Project Lighthouse' },
          decisionCount: 2,
        },
        drafts: [],
        status: {
          compiledState: 'needs-sync',
          compiledAt: new Date(Date.now() - 120_000).toISOString(),
          latestMemoryUpdatedAt: new Date().toISOString(),
          syncRequired: true,
        },
      }),
    });

    await waitFor(() => expect(screen.getByText(/sync required/i)).toBeInTheDocument());
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it('shows empty state when memory summary is missing', async () => {
    render(<MemoryPanel teamId="team1" />);
    snapshotHandlers[0]({ exists: () => false });

    await waitFor(() => {
      expect(screen.getByText(/No memory yet/i)).toBeInTheDocument();
    });
  });
});
