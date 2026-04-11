import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotCallbacks = new Map();

vi.mock('firebase/firestore', () => ({
  collection: (...parts) => ({ path: parts.filter((part) => typeof part === 'string').join('/') }),
  query: (ref) => ref,
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: (_ref, onNext) => {
    snapshotCallbacks.set(_ref.path, onNext);
    return () => {};
  },
}));

vi.mock('../firebase.js', () => ({
  db: {},
}));

import ReportsPage from './ReportsPage.jsx';

describe('ReportsPage', () => {
  beforeEach(() => {
    snapshotCallbacks.clear();
  });

  it('renders recent gsync reports in newest-first order', async () => {
    render(<ReportsPage teamId="team-1" />);

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-1/reports')).toBe(true));

    snapshotCallbacks.get('teams/team-1/reports')({
      docs: [
        {
          id: 'report-1',
          data: () => ({
            kind: 'feature',
            title: 'Add plan diff previews',
            body: 'I wanted to compare revisions before pulling a plan.',
            source: 'cli',
            createdBySeatName: 'agent-alpha',
            createdAt: new Date(Date.now() - 10 * 60_000),
          }),
        },
        {
          id: 'report-2',
          data: () => ({
            kind: 'bug',
            title: 'Join code errors are too vague',
            body: 'The failure path does not explain whether the code expired or was mistyped.',
            severity: 'high',
            source: 'cli',
            createdBySeatName: 'agent-beta',
            createdAt: new Date(Date.now() - 1 * 60_000),
          }),
        },
      ],
    });

    await waitFor(() => expect(screen.getByText('Join code errors are too vague')).toBeInTheDocument());

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('Join code errors are too vague');
    expect(headings[1]).toHaveTextContent('Add plan diff previews');
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('agent-beta')).toBeInTheDocument();
  });

  it('shows the empty state when no reports exist', async () => {
    render(<ReportsPage teamId="team-1" />);

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-1/reports')).toBe(true));

    snapshotCallbacks.get('teams/team-1/reports')({ docs: [] });

    expect(await screen.findByText(/No reports yet/i)).toBeInTheDocument();
    expect(screen.getByText(/gsync report bug/i)).toBeInTheDocument();
  });
});
