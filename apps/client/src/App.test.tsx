import { act, render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import * as authApi from './services/authApi';
import * as doctorApi from './services/doctorApi';

vi.mock('./services/authApi', () => ({
  getCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  logoutUser: vi.fn(),
}));

vi.mock('./services/doctorApi', () => ({
  listPatients: vi.fn(),
  listInvitations: vi.fn(),
  invitePatient: vi.fn(),
  listPatientReadings: vi.fn(),
  listAllPatientReadings: vi.fn(),
  getPatientDailyReport: vi.fn(),
  getPatientMonthToDateReport: vi.fn(),
  getPatientMonthlyReport: vi.fn(),
  submitPatientReportJob: vi.fn(),
  getPatientReportJobStatus: vi.fn(),
  getPatientReportJobResult: vi.fn(),
}));

const PATIENT = {
  id: 'u1',
  name: 'Demo User',
  email: 'demo@example.com',
  role: 'patient' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DOCTOR = {
  id: 'd1',
  name: 'Demo Doctor',
  email: 'doctor@example.com',
  role: 'doctor' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(doctorApi.listPatients).mockResolvedValue([]);
  vi.mocked(doctorApi.listInvitations).mockResolvedValue([]);
});

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
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(PATIENT);

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
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(PATIENT);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Readings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Track your glucose/ })).not.toBeInTheDocument();
  });

  it('sends a doctor to the doctor dashboard after login', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(DOCTOR);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Patients' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invitations' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Readings' })).not.toBeInTheDocument();
  });

  it('sends a doctor from a patient route to the doctor home', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(DOCTOR);

    render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Patients' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Readings' })).not.toBeInTheDocument();
  });

  it('sends a patient from a doctor route back to the patient home', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(PATIENT);

    render(
      <MemoryRouter initialEntries={['/doctor/patients']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Care team' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Invitations' })).not.toBeInTheDocument();
  });

  it('redirects old doctor bookmarks to the new doctor routes', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(DOCTOR);

    render(
      <MemoryRouter initialEntries={['/patients']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Patients' })).toBeInTheDocument();
    expect(
      screen.getByText('Only patients with an active, patient-accepted assignment appear here.'),
    ).toBeInTheDocument();
  });

  it('serves /patient/dashboard as an alias for the patient home', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(PATIENT);

    function LocationProbe() {
      return <p data-testid="path">{useLocation().pathname}</p>;
    }

    render(
      <MemoryRouter initialEntries={['/patient/dashboard']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/today');
    });
    expect(screen.getByRole('link', { name: 'Care team' })).toBeInTheDocument();
  });

  it('shows no login form while the session is still loading', async () => {
    let resolveMe: ((user: typeof PATIENT) => void) | undefined;
    vi.mocked(authApi.getCurrentUser).mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );

    render(
      <MemoryRouter initialEntries={['/today']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Readings' })).not.toBeInTheDocument();

    await act(async () => {
      resolveMe?.(PATIENT);
    });

    expect(await screen.findByRole('link', { name: 'Readings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
  });
});
