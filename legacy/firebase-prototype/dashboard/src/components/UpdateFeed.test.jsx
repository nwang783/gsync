import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, afterEach, beforeEach, expect } from 'vitest';

vi.mock('./PMAgentCompanion.jsx', () => ({
  default: ({ mood }) => <div data-testid="pm-mascot" data-mood={mood} />,
}));

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
  afterEach(() => {
    cleanup();
    snapshotCallbacks.clear();
  });

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

  it('renders PM agent panel when agent mood is present in the insight document', async () => {
    render(<UpdateFeed teamId="team-pm" />);

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-pm/plans')).toBe(true));
    snapshotCallbacks.get('teams/team-pm/plans')({ docs: [makePlan('1', 5)] });

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-pm/insights/activity-summary')).toBe(true));
    snapshotCallbacks.get('teams/team-pm/insights/activity-summary')({
      exists: () => true,
      data: () => ({
        status: 'ready',
        model: 'google/gemini-3.1-flash-lite-preview',
        generatedAt: new Date(),
        confidence: 0.91,
        headline: 'Team is on track with one merge landed.',
        summaryBullets: ['One plan merged today.', 'Two plans still active.'],
        riskFlags: [],
        nextActions: [],
        sourceWindow: { recentActivityCount: 3 },
        agent: { mood: 'celebrating' },
        recommendations: {
          closeCandidates: [],
          nextCandidates: [
            {
              planId: 'pn1',
              slug: 'auth-flow',
              title: 'Auth flow implementation',
              reason: 'Advances 3-day target',
              confidence: 0.8,
              evidence: ['supports 3-day target', 'active in last 24h'],
            },
          ],
        },
      }),
    });

    await waitFor(() => expect(screen.getByText('## pm agent')).toBeInTheDocument());
    expect(screen.getByText('Team is on track with one merge landed.')).toBeInTheDocument();
    expect(screen.getByText('auth-flow')).toBeInTheDocument();
    expect(screen.getByText('likely next')).toBeInTheDocument();
    expect(screen.getByText('supports 3-day target')).toBeInTheDocument();

    const mascot = screen.getByTestId('pm-mascot');
    expect(mascot).toHaveAttribute('data-mood', 'celebrating');
  });

  it('falls back to ## ai summary card when agent mood is absent', async () => {
    render(<UpdateFeed teamId="team-legacy" />);

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-legacy/plans')).toBe(true));
    // provide one plan so UpdateFeed renders ActivitySummary (avoids the empty-state early return)
    snapshotCallbacks.get('teams/team-legacy/plans')({ docs: [makePlan('1', 5)] });

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-legacy/insights/activity-summary')).toBe(true));
    snapshotCallbacks.get('teams/team-legacy/insights/activity-summary')({
      exists: () => true,
      data: () => ({
        status: 'ready',
        headline: 'No activity this week.',
        summaryBullets: ['No plans active.'],
        riskFlags: [],
        nextActions: [],
        confidence: 0.5,
        sourceWindow: { recentActivityCount: 0 },
        // no `agent` field — legacy document shape
      }),
    });

    await waitFor(() => expect(screen.getByText('## ai summary')).toBeInTheDocument());
    expect(screen.getByText('No activity this week.')).toBeInTheDocument();
    expect(screen.queryByText('## pm agent')).not.toBeInTheDocument();
  });

  it('renders PM agent panel with close recommendations', async () => {
    render(<UpdateFeed teamId="team-close" />);

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-close/plans')).toBe(true));
    snapshotCallbacks.get('teams/team-close/plans')({ docs: [makePlan('1', 60)] });

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-close/insights/activity-summary')).toBe(true));
    snapshotCallbacks.get('teams/team-close/insights/activity-summary')({
      exists: () => true,
      data: () => ({
        status: 'ready',
        headline: 'One stale plan should be addressed.',
        summaryBullets: ['One plan is stale.'],
        riskFlags: [],
        nextActions: [],
        confidence: 0.7,
        sourceWindow: { recentActivityCount: 1 },
        agent: { mood: 'nudging' },
        recommendations: {
          closeCandidates: [
            {
              planId: 'pc1',
              slug: 'old-feature',
              title: 'Old feature work',
              reason: 'No updates in 4+ days',
              confidence: 0.72,
              action: 'abandoned',
              evidence: ['stale 4.2d', 'no goal alignment'],
            },
          ],
          nextCandidates: [],
        },
      }),
    });

    await waitFor(() => expect(screen.getByText('## pm agent')).toBeInTheDocument());
    expect(screen.getByText('consider closing')).toBeInTheDocument();
    expect(screen.getByText('old-feature')).toBeInTheDocument();
    expect(screen.getByText('mark abandoned')).toBeInTheDocument();
    expect(screen.getByText('stale 4.2d')).toBeInTheDocument();
  });

  it('counts arbitrary non-terminal statuses as active', async () => {
    render(<UpdateFeed teamId="team-active" />);

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-active/plans')).toBe(true));
    snapshotCallbacks.get('teams/team-active/plans')({
      docs: [
        { ...makePlan('1', 1), data: () => ({ ...makePlan('1', 1).data(), status: 'blocked-on-design' }) },
        { ...makePlan('2', 2), data: () => ({ ...makePlan('2', 2).data(), status: 'qa-ready' }) },
        { ...makePlan('3', 3), data: () => ({ ...makePlan('3', 3).data(), status: 'merged' }) },
      ],
    });

    await waitFor(() => expect(snapshotCallbacks.has('teams/team-active/insights/activity-summary')).toBe(true));
    snapshotCallbacks.get('teams/team-active/insights/activity-summary')({
      exists: () => true,
      data: () => ({
        status: 'ready',
        headline: 'Custom statuses remain visible.',
        summaryBullets: [],
        riskFlags: [],
        nextActions: [],
        confidence: 0.5,
        sourceWindow: { recentActivityCount: 0 },
      }),
    });

    await waitFor(() => expect(document.querySelector('.activity-stats')?.textContent).toContain('2 active'));
  });
});
