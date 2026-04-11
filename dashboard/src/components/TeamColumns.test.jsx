import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotCallbacks = [];
const queryCalls = [];
const whereCalls = [];

vi.mock('firebase/firestore', () => ({
  collection: (...parts) => ({ path: parts.join('/') }),
  query: (...parts) => {
    queryCalls.push(parts);
    return { parts };
  },
  where: (...parts) => {
    whereCalls.push(parts);
    return { parts };
  },
  onSnapshot: (_ref, onNext) => {
    snapshotCallbacks.push(onNext);
    return () => {};
  },
}));

vi.mock('../firebase.js', () => ({
  db: {},
}));

import TeamColumns from './TeamColumns.jsx';

describe('TeamColumns', () => {
  beforeEach(() => {
    cleanup();
    snapshotCallbacks.length = 0;
    queryCalls.length = 0;
    whereCalls.length = 0;
  });

  it('shows summary-focused cards with special goal tags', async () => {
    render(<TeamColumns teamId="team1" onSelectPlan={() => {}} />);

    snapshotCallbacks[0]({
      docs: [
        {
          id: 'plan-1',
          data: () => ({
            author: 'nathan-laptop',
            slug: 'enable-self-serve',
            summary: 'Enable creators to publish their first product without manual help.',
            alignment: 'Establishes the 2-week goal by focusing on the fastest path to launch.',
            status: 'in-progress',
            updatedAt: new Date(),
          }),
        },
        {
          id: 'plan-2',
          data: () => ({
            author: 'nathan-laptop',
            slug: 'stabilize-checkout',
            summary: 'Fix checkout blockers so customers can complete purchase reliably.',
            alignment: 'Establishes the 3-day target as a fix-and-ship sprint.',
            status: 'in-progress',
            updatedAt: new Date(),
          }),
        },
      ],
    });

    await waitFor(() => expect(screen.getByText('Enable creators to publish their first product without manual help.')).toBeInTheDocument());

    expect(screen.getByText('2-week goal')).toBeInTheDocument();
    expect(screen.getByText('3-day target')).toBeInTheDocument();
    expect(screen.queryByText(/src\//i)).not.toBeInTheDocument();
  });

  it('sorts each author column with the most recent plan first', async () => {
    render(<TeamColumns teamId="team1" onSelectPlan={() => {}} />);

    snapshotCallbacks[0]({
      docs: [
        {
          id: 'older',
          data: () => ({
            author: 'nathan-laptop',
            slug: 'older-plan',
            summary: 'Older summary',
            status: 'in-progress',
            updatedAt: new Date('2026-04-09T09:00:00Z'),
          }),
        },
        {
          id: 'newer',
          data: () => ({
            author: 'nathan-laptop',
            slug: 'newer-plan',
            summary: 'Newer summary',
            status: 'in-progress',
            updatedAt: new Date('2026-04-09T10:00:00Z'),
          }),
        },
      ],
    });

    await waitFor(() => expect(screen.getByText('Newer summary')).toBeInTheDocument());

    const cards = document.querySelectorAll('.plan-card');
    expect(cards[0].textContent).toContain('newer-plan');
    expect(cards[1].textContent).toContain('older-plan');
  });

  it('shows a placeholder teammate column when only one author is active', async () => {
    render(<TeamColumns teamId="team1" onSelectPlan={() => {}} />);

    snapshotCallbacks[0]({
      docs: [
        {
          id: 'solo',
          data: () => ({
            author: 'nathan-laptop',
            slug: 'solo-plan',
            summary: 'Only active plan right now',
            status: 'in-progress',
            updatedAt: new Date(),
          }),
        },
      ],
    });

    await waitFor(() => expect(screen.getByText('Only active plan right now')).toBeInTheDocument());

    expect(screen.getByText('waiting for another teammate')).toBeInTheDocument();
    expect(screen.getByText(/publish an active plan/i)).toBeInTheDocument();
  });

  it('renders a minimal update card for goal-linked plans with updates', async () => {
    render(<TeamColumns teamId="team1" onSelectPlan={() => {}} />);

    snapshotCallbacks[0]({
      docs: [
        {
          id: 'goal-update',
          data: () => ({
            author: 'nathan-laptop',
            slug: 'stabilize-checkout',
            summary: 'Full summary should be suppressed for update cards',
            alignment: 'Establishes the 3-day target as a fix-and-ship sprint.',
            status: 'in-progress',
            updatedAt: new Date('2026-04-09T10:00:00Z'),
            updates: [
              {
                note: 'Adjusted the 3-day target after checkout validation landed.',
                author: 'nathan-laptop',
                timestamp: new Date('2026-04-09T10:00:00Z'),
              },
            ],
          }),
        },
      ],
    });

    await waitFor(() => expect(screen.getByText(/adjusted the 3-day target/i)).toBeInTheDocument());

    expect(screen.getByText('plan update')).toBeInTheDocument();
    expect(screen.queryByText('Full summary should be suppressed for update cards')).not.toBeInTheDocument();
    expect(screen.getByText('3-day target')).toBeInTheDocument();
  });

  it('includes proposed plans in individual histories', async () => {
    render(<TeamColumns teamId="team1" onSelectPlan={() => {}} />);

    expect(whereCalls).toContainEqual(['status', 'in', ['proposed', 'draft', 'in-progress', 'review']]);
    expect(queryCalls).toHaveLength(1);

    snapshotCallbacks[0]({
      docs: [
        {
          id: 'proposed-plan',
          data: () => ({
            author: 'nathan-laptop',
            slug: 'cart-lazy-init',
            summary: 'Stop eager cart initialization on unrelated pages',
            status: 'proposed',
            updatedAt: new Date('2026-04-09T10:00:00Z'),
          }),
        },
      ],
    });

    await waitFor(() => expect(screen.getByText('Stop eager cart initialization on unrelated pages')).toBeInTheDocument());

    expect(screen.getByText('cart-lazy-init')).toBeInTheDocument();
    expect(screen.getByText('Stop eager cart initialization on unrelated pages')).toBeInTheDocument();
  });
});
