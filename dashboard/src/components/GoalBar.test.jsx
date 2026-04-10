import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotHandlers = [];

vi.mock('firebase/firestore', () => ({
  doc: (...parts) => ({ kind: 'doc', path: parts.join('/') }),
  collection: (...parts) => ({ kind: 'collection', path: parts.join('/') }),
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
  });

  it('routes the 2-week goal card to the linked canonical plan when alignment matches', async () => {
    const onSelectPlan = vi.fn();
    render(<GoalBar teamId="team1" onSelectPlan={onSelectPlan} />);

    const twoWeekHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/2week'));
    const threeDayHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/meta/3day'));
    const plansHandler = snapshotHandlers.find((entry) => entry.ref.path.includes('/plans'));

    twoWeekHandler.onNext({
      exists: () => true,
      data: () => ({
        content: 'Enable self-serve onboarding by April 22',
        updatedAt: new Date(),
        updatedBy: 'nathan-laptop',
      }),
    });
    threeDayHandler.onNext({
      exists: () => false,
    });
    plansHandler.onNext({
      docs: [
        {
          id: 'plan-2w',
          data: () => ({
            slug: 'enable-self-serve',
            summary: 'Enable creators to launch without manual help',
            alignment: 'Establishes the 2-week goal by shipping the fastest path to first product',
            updatedAt: new Date(),
          }),
        },
      ],
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /2-week goal/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /2-week goal/i }));

    expect(onSelectPlan).toHaveBeenCalledWith('plan-2w');
  });
});
