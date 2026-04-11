import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotCallbacks = new Map();

vi.mock('firebase/firestore', () => ({
  collection: (...parts) => ({ path: parts.filter((part) => typeof part === 'string').join('/') }),
  doc: (...parts) => ({ path: parts.filter((part) => typeof part === 'string').join('/') }),
  onSnapshot: (_ref, onNext) => {
    snapshotCallbacks.set(_ref.path, onNext);
    return () => {};
  },
}));

vi.mock('../firebase.js', () => ({
  db: {},
}));

import UpdateFeed from './UpdateFeed.jsx';

function makePlan(id, minuteOffset) {
  return {
    id,
    data: () => ({
      author: `agent-${id}`,
      slug: `plan-${id}`,
      createdAt: new Date(Date.now() - minuteOffset * 60_000),
      updates: [],
    }),
  };
}

describe('UpdateFeed', () => {
  beforeEach(() => {
    snapshotCallbacks.clear();
  });

  it('shows the 10 most recent entries first and loads more on demand', async () => {
    render(<UpdateFeed teamId="team-1" />);

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-1/plans')).toBe(true));

    snapshotCallbacks.get('teams/team-1/plans')({
      docs: [
        { ...makePlan('1', 1), data: () => ({ ...makePlan('1', 1).data(), status: 'review' }) },
        { ...makePlan('2', 2), data: () => ({ ...makePlan('2', 2).data(), status: 'in-progress' }) },
        { ...makePlan('3', 3), data: () => ({ ...makePlan('3', 3).data(), status: 'draft' }) },
        { ...makePlan('4', 4), data: () => ({ ...makePlan('4', 4).data(), status: 'merged' }) },
        { ...makePlan('5', 5), data: () => ({ ...makePlan('5', 5).data(), status: 'review' }) },
        { ...makePlan('6', 6), data: () => ({ ...makePlan('6', 6).data(), status: 'in-progress' }) },
        { ...makePlan('7', 7), data: () => ({ ...makePlan('7', 7).data(), status: 'draft' }) },
        { ...makePlan('8', 8), data: () => ({ ...makePlan('8', 8).data(), status: 'review' }) },
        { ...makePlan('9', 9), data: () => ({ ...makePlan('9', 9).data(), status: 'merged' }) },
        { ...makePlan('10', 10), data: () => ({ ...makePlan('10', 10).data(), status: 'review' }) },
        { ...makePlan('11', 11), data: () => ({ ...makePlan('11', 11).data(), status: 'in-progress' }) },
      ],
    });

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-1/insights/activity-summary')).toBe(true));

    snapshotCallbacks.get('teams/team-1/insights/activity-summary')({
      exists: () => true,
      data: () => ({
        status: 'ready',
        model: 'google/gemini-3.1-flash-lite-preview',
        generatedAt: new Date(),
        confidence: 0.88,
        headline: 'Activity is active and broadly aligned.',
        summaryBullets: ['Four contributors are active today.', 'Review traffic is the main source of churn.'],
        riskFlags: ['One plan has moved to merged while others are still in review.'],
        nextActions: ['Close the review queue before adding new plans.'],
        sourceWindow: { recentActivityCount: 6 },
      }),
    });

    await waitFor(() => expect(screen.getByText('plan-1')).toBeInTheDocument());

    expect(screen.getByText('## ai summary')).toBeInTheDocument();
    expect(screen.getByText('Activity is active and broadly aligned.')).toBeInTheDocument();
    expect(screen.getByText('Four contributors are active today.')).toBeInTheDocument();
    expect(screen.getByText(/google\/gemini-3.1-flash-lite-preview/)).toBeInTheDocument();

    expect(screen.getByText('plan-1')).toBeInTheDocument();
    expect(screen.getByText('plan-10')).toBeInTheDocument();
    expect(screen.queryByText('plan-11')).not.toBeInTheDocument();

    const items = document.querySelectorAll('.feed-item');
    expect(items).toHaveLength(10);
    expect(items[0].textContent).toContain('plan-1');

    fireEvent.click(screen.getByRole('button', { name: /load 10 more/i }));
    expect(await screen.findByText('plan-11')).toBeInTheDocument();
  });
});
