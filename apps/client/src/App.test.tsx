import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import * as authApi from './services/authApi';

vi.mock('./services/authApi', () => ({
  getCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  logoutUser: vi.fn(),
}));

afterEach(cleanup);

describe('App routing', () => {
  it('shows the landing page to unauthenticated visitors', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Authentication required.'));

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /Track your glucose/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('redirects unauthenticated visitors from the app to the login page', async () => {
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Authentication required.'));

    render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    });
  });

  it('redirects authenticated users away from the login page', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      id: 'u1',
      name: 'Demo User',
      email: 'demo@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    // The login form must not appear once the session is confirmed; the
    // dashboard shell with its navigation renders instead.
    expect(await screen.findByRole('link', { name: 'Readings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
  });

  it('sends authenticated users from the landing page into the app', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      id: 'u1',
      name: 'Demo User',
      email: 'demo@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Readings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Track your glucose/ })).not.toBeInTheDocument();
  });
});
