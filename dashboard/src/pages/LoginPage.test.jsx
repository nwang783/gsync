import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const loginMock = vi.fn().mockResolvedValue({});
const joinTeamMock = vi.fn().mockResolvedValue({});

vi.mock('../auth.jsx', () => ({
  useAuth: () => ({
    login: loginMock,
    joinTeam: joinTeamMock,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import LoginPage from './LoginPage.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('supports returning users signing in with a seat key', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/paste your seat key/i), {
      target: { value: 'seat-key-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('seat-key-123'));
    expect(navigateMock).toHaveBeenCalledWith('/app');
  });

  it('supports new teammates joining with a code and seat name', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/^join code$/i), {
      target: { value: 'SP7E-YKDH-LPC3' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your seat name/i), {
      target: { value: 'teammate-laptop' },
    });
    fireEvent.click(screen.getByRole('button', { name: /join team/i }));

    await waitFor(() => expect(joinTeamMock).toHaveBeenCalledWith('SP7E-YKDH-LPC3', 'teammate-laptop'));
    expect(navigateMock).toHaveBeenCalledWith('/app');
  });
});
