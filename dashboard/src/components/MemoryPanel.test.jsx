import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotHandlers = [];

vi.mock('firebase/firestore', () => ({
  doc: (...parts) => ({ path: parts.join('/') }),
  collection: (...parts) => ({ path: parts.join('/') }),
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
    expect(screen.getByText(/fresh/i)).toBeInTheDocument();
  });

  it('shows multiple company briefs instead of replacing the previous one', async () => {
    const { container } = render(<MemoryPanel teamId="team1" />);
    const panel = within(container);

    snapshotHandlers[0]({
      exists: () => true,
      data: () => ({
        approved: {
          companyBrief: { title: 'Latest Company Brief', count: 2 },
          projectBrief: { title: 'Project Lighthouse', count: 1 },
          decisionCount: 0,
          companyBriefCount: 2,
          projectBriefCount: 1,
        },
        drafts: [],
        status: {
          compiledState: 'fresh',
          compiledAt: new Date(),
        },
      }),
    });

    snapshotHandlers[1]({
      docs: [
        {
          id: 'm1',
          data: () => ({
            kind: 'companyBrief',
            title: 'Company North Star',
            content: '# North Star\n\nKeep the company aligned.',
            approvedAt: new Date('2026-04-01T12:00:00Z'),
          }),
        },
        {
          id: 'm2',
          data: () => ({
            kind: 'companyBrief',
            title: 'Company Operating Principles',
            content: '# Principles\n\nShip the complete thing.',
            approvedAt: new Date('2026-04-02T12:00:00Z'),
          }),
        },
      ],
    });

    snapshotHandlers[2]({ exists: () => false });
    snapshotHandlers[3]({ exists: () => false });
    snapshotHandlers[4]({ exists: () => false, data: () => ({ entries: [] }) });

    await waitFor(() => expect(panel.getByRole('button', { name: /^company briefs$/i })).toBeInTheDocument());
    fireEvent.click(panel.getByRole('button', { name: /^company briefs$/i }));

    await waitFor(() => {
      expect(panel.getByText(/Company North Star/i)).toBeInTheDocument();
      expect(panel.getByText(/Company Operating Principles/i)).toBeInTheDocument();
      expect(panel.getByText(/Keep the company aligned/i)).toBeInTheDocument();
      expect(panel.getByText(/Ship the complete thing/i)).toBeInTheDocument();
    });
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
