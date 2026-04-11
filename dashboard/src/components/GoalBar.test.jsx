import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotHandlers = [];

vi.mock('firebase/firestore', () => ({
  doc: (...parts) => ({ kind: 'doc', path: parts.join('/') }),
  onSnapshot: (ref, onNext) => {
    snapshotHandlers.push({ ref, onNext });
    return () => {};
  },
}));

vi.mock('../firebase.js', () => ({
  db: {},
}));

import GoalBar from './GoalBar.jsx';

describe('GoalBar', () => {
  beforeEach(() => {
    snapshotHandlers.length = 0;
    cleanup();
  });

  it('opens the linked plan directly when planId is set on the meta doc', async () => {
    const onSelectPlan = vi.fn();
    render(<GoalBar teamId="team1" onSelectPlan={onSelectPlan} />);

    const twoWeekHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/2week'));
    const threeDayHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/3day'));

    twoWeekHandler.onNext({
      exists: () => true,
      data: () => ({
        planId: 'plan-2w',
        summary: 'Enable self-serve onboarding by April 22',
        updatedAt: new Date(),
        updatedBy: 'nathan-laptop',
      }),
    });
    threeDayHandler.onNext({ exists: () => false });

    await waitFor(() => expect(screen.getAllByRole('button', { name: /2-week goal/i })).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /2-week goal/i }));

    expect(onSelectPlan).toHaveBeenCalledWith('plan-2w');
  });

  it('opens the inline detail modal when no planId is set', async () => {
    const onSelectPlan = vi.fn();
    render(<GoalBar teamId="team1" onSelectPlan={onSelectPlan} />);

    const twoWeekHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/2week'));
    const threeDayHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/3day'));

    twoWeekHandler.onNext({
      exists: () => true,
      data: () => ({
        summary: 'Enable self-serve onboarding by April 22',
        updatedAt: new Date(),
        updatedBy: 'nathan-laptop',
      }),
    });
    threeDayHandler.onNext({ exists: () => false });

    await waitFor(() => expect(screen.getAllByRole('button', { name: /2-week goal/i })).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /2-week goal/i }));

    expect(onSelectPlan).not.toHaveBeenCalled();
    expect(screen.getByText('Enable self-serve onboarding by April 22')).toBeInTheDocument();
  });

  it('shows "not set" when goal meta doc does not exist', async () => {
    render(<GoalBar teamId="team1" onSelectPlan={vi.fn()} />);

    const twoWeekHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/2week'));
    const threeDayHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/3day'));

    twoWeekHandler.onNext({ exists: () => false });
    threeDayHandler.onNext({ exists: () => false });

    await waitFor(() => expect(screen.getAllByText('not set')).toHaveLength(2));
  });

  it('modal label stays correct when Firestore re-pushes a new object reference', async () => {
    const onSelectPlan = vi.fn();
    render(<GoalBar teamId="team1" onSelectPlan={onSelectPlan} />);

    const twoWeekHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/2week'));
    const threeDayHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/3day'));

    const goalData = () => ({
      summary: 'Ship WebSocket layer',
      updatedAt: new Date(),
      updatedBy: 'nathan-laptop',
    });

    twoWeekHandler.onNext({ exists: () => true, data: goalData });
    threeDayHandler.onNext({ exists: () => false });

    await waitFor(() => expect(screen.getByRole('button', { name: /2-week goal/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /2-week goal/i }));

    // Simulate Firestore re-pushing a new object reference
    twoWeekHandler.onNext({ exists: () => true, data: goalData });

    await waitFor(() => expect(screen.getByText('2-week goal')).toBeInTheDocument());
  });
});
