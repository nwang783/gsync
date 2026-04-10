import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';

const snapshotCallbacks = [];

vi.mock('firebase/firestore', () => ({
  collection: (...parts) => ({ path: parts.join('/') }),
  onSnapshot: (_ref, onNext) => {
    snapshotCallbacks.push(onNext);
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
    snapshotCallbacks.length = 0;
  });

  it('shows the 10 most recent entries first and loads more on demand', async () => {
    render(<UpdateFeed teamId="team-1" />);

    snapshotCallbacks[0]({
      docs: [
        makePlan('1', 1),
        makePlan('2', 2),
        makePlan('3', 3),
        makePlan('4', 4),
        makePlan('5', 5),
        makePlan('6', 6),
        makePlan('7', 7),
        makePlan('8', 8),
        makePlan('9', 9),
        makePlan('10', 10),
        makePlan('11', 11),
      ],
    });

    await waitFor(() => expect(screen.getByText('plan-1')).toBeInTheDocument());

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
