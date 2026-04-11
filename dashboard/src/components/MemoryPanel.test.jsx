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

function emitSnapshots(entries) {
  entries.forEach(({ index, payload }) => {
    snapshotHandlers[index](payload);
  });
}

describe('MemoryPanel', () => {
  beforeEach(() => {
    snapshotHandlers.length = 0;
  });

  it('renders overview stats for the unified memory timeline', async () => {
    render(<MemoryPanel teamId="team1" />);

    emitSnapshots([
      {
        index: 0,
        payload: {
          exists: () => true,
          data: () => ({
            memories: {
              count: 2,
              latest: {
                title: 'Launch retrospective',
                createdAt: new Date('2026-04-02T10:00:00Z'),
                createdBy: 'agent-admin',
              },
            },
            status: {
              compiledState: 'fresh',
              compiledAt: new Date('2026-04-02T10:30:00Z'),
              latestMemoryUpdatedAt: new Date('2026-04-02T10:00:00Z'),
              syncRequired: false,
            },
          }),
        },
      },
      {
        index: 1,
        payload: {
          docs: [
            {
              id: 'm1',
              data: () => ({
                title: 'Launch retrospective',
                content: 'We learned to keep the flow simple.',
                createdAt: new Date('2026-04-02T10:00:00Z'),
                createdBy: 'agent-admin',
              }),
            },
            {
              id: 'm2',
              data: () => ({
                title: 'Memory cleanup',
                content: 'Timeline items should read like an activity feed.',
                createdAt: new Date('2026-04-01T09:00:00Z'),
                createdBy: 'agent-peer',
              }),
            },
          ],
        },
      },
      { index: 2, payload: { docs: [] } },
      { index: 3, payload: { exists: () => false } },
      { index: 4, payload: { exists: () => false } },
      { index: 5, payload: { exists: () => false, data: () => ({ entries: [] }) } },
    ]);

    await waitFor(() => expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /memories/i })).toBeInTheDocument();
    expect(screen.getByText(/^2$/)).toBeInTheDocument();
    expect(screen.getByText(/launch retrospective/i)).toBeInTheDocument();
    expect(screen.getByText(/fresh/i)).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it('renders the memories timeline in newest-first order', async () => {
    const { container } = render(<MemoryPanel teamId="team1" />);
    const panel = within(container);

    emitSnapshots([
      {
        index: 0,
        payload: {
          exists: () => true,
          data: () => ({
            memories: {
              count: 3,
              latest: {
                title: 'Newest memory',
                createdAt: new Date('2026-04-04T14:00:00Z'),
                createdBy: 'agent-admin',
              },
            },
            status: {
              compiledState: 'fresh',
              compiledAt: new Date('2026-04-04T14:05:00Z'),
              latestMemoryUpdatedAt: new Date('2026-04-04T14:00:00Z'),
              syncRequired: false,
            },
          }),
        },
      },
      {
        index: 1,
        payload: {
          docs: [
            {
              id: 'new-1',
              data: () => ({
                title: 'Newest memory',
                content: 'This one sits at the top of the feed.',
                tags: ['release'],
                createdAt: new Date('2026-04-04T14:00:00Z'),
                createdBy: 'agent-admin',
              }),
            },
          ],
        },
      },
      {
        index: 2,
        payload: {
          docs: [
            {
              id: 'legacy-1',
              data: () => ({
                title: 'Legacy memory',
                content: 'Older entries still show up in the same stream.',
                approvedAt: new Date('2026-04-02T08:00:00Z'),
                approvedBy: 'agent-peer',
              }),
            },
          ],
        },
      },
      { index: 3, payload: { exists: () => false } },
      { index: 4, payload: { exists: () => false } },
      {
        index: 5,
        payload: {
          exists: () => true,
          data: () => ({
            entries: [
              {
                summary: 'Decision note',
                detail: 'The timeline should stay unified.',
                decidedAt: '2026-04-03',
                decidedBy: 'agent-admin',
              },
            ],
          }),
        },
      },
    ]);

    await waitFor(() => expect(panel.getByRole('button', { name: /memories/i })).toBeInTheDocument());
    fireEvent.click(panel.getByRole('button', { name: /memories/i }));

    await waitFor(() => {
      expect(panel.getByText(/Newest memory/i)).toBeInTheDocument();
      expect(panel.getByText(/Legacy memory/i)).toBeInTheDocument();
      expect(panel.getByText(/Decision note/i)).toBeInTheDocument();
      expect(panel.getByText(/release/i)).toBeInTheDocument();
    });

    const items = container.querySelectorAll('.feed-item');
    expect(items[0]).toHaveTextContent(/Newest memory/);
    expect(items[1]).toHaveTextContent(/Decision note/);
    expect(items[2]).toHaveTextContent(/Legacy memory/);
  });

  it('falls back to legacy memory when no new memories exist', async () => {
    const { container } = render(<MemoryPanel teamId="team1" />);
    const panel = within(container);

    emitSnapshots([
      {
        index: 0,
        payload: {
          exists: () => false,
        },
      },
      { index: 1, payload: { docs: [] } },
      {
        index: 2,
        payload: {
          docs: [
            {
              id: 'legacy-1',
              data: () => ({
                title: 'Legacy memory',
                content: 'Older entries still show up in the same stream.',
                approvedAt: new Date('2026-04-02T08:00:00Z'),
                approvedBy: 'agent-peer',
              }),
            },
          ],
        },
      },
      { index: 3, payload: { exists: () => false } },
      { index: 4, payload: { exists: () => false } },
      {
        index: 5,
        payload: {
          exists: () => true,
          data: () => ({
            entries: [
              {
                summary: 'Decision note',
                detail: 'The timeline should stay unified.',
                decidedAt: '2026-04-03',
                decidedBy: 'agent-admin',
              },
            ],
          }),
        },
      },
    ]);

    await waitFor(() => expect(panel.getByRole('button', { name: /overview/i })).toBeInTheDocument());
    expect(panel.getByText(/Decision note/i)).toBeInTheDocument();
    fireEvent.click(panel.getByRole('button', { name: /memories/i }));
    await waitFor(() => expect(panel.getByText(/Legacy memory/i)).toBeInTheDocument());
    expect(panel.queryByText(/No memory yet/i)).not.toBeInTheDocument();
  });

  it('shows empty state when memory summary is missing', async () => {
    render(<MemoryPanel teamId="team1" />);
    emitSnapshots([
      { index: 0, payload: { exists: () => false } },
      { index: 1, payload: { docs: [] } },
      { index: 2, payload: { docs: [] } },
      { index: 3, payload: { exists: () => false } },
      { index: 4, payload: { exists: () => false } },
      { index: 5, payload: { exists: () => false, data: () => ({ entries: [] }) } },
    ]);

    await waitFor(() => {
      expect(screen.getByText(/No memory yet/i)).toBeInTheDocument();
    });
  });
});
