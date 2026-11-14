import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext.js';
import LoginPage from './LoginPage.js';
import RegisterPage from './RegisterPage.js';
import * as authApi from '../services/authApi.js';
import { ApiError } from '../services/http.js';
import type { SafeUser } from '../types/user.js';

vi.mock('../services/authApi', () => ({
  getCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  logoutUser: vi.fn(),
}));

const PATIENT: SafeUser = {
  id: 'u1',
  name: 'Demo User',
  email: 'demo@example.com',
  role: 'patient',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DOCTOR: SafeUser = {
  id: 'd1',
  name: 'Demo Doctor',
  email: 'doctor@example.com',
  role: 'doctor',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Authentication required.'));
  vi.mocked(authApi.logoutUser).mockResolvedValue({ status: 'ok', message: 'Logged out.' });
});

afterEach(cleanup);

function renderAuthPages(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/today" element={<p>Patient home</p>} />
          <Route path="/doctor/dashboard" element={<p>Doctor home</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function patientOption() {
  return screen.getByRole('button', { name: /^Patient/ });
}

function doctorOption() {
  return screen.getByRole('button', { name: /^Doctor/ });
}

async function completeLogin(email = 'demo@example.com', password = 'password123') {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  return user;
}

describe('Login role selection', () => {
  it('selects Patient by default', async () => {
    renderAuthPages('/login');

    expect(patientOption()).toHaveAttribute('aria-pressed', 'true');
    expect(doctorOption()).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the selected role', async () => {
    const user = userEvent.setup();
    renderAuthPages('/login');

    await user.click(doctorOption());

    expect(doctorOption()).toHaveAttribute('aria-pressed', 'true');
    expect(patientOption()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('is operable by keyboard', async () => {
    const user = userEvent.setup();
    renderAuthPages('/login');

    await user.tab();
    expect(patientOption()).toHaveFocus();

    await user.tab();
    expect(doctorOption()).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(doctorOption()).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends a patient to the patient home', async () => {
    vi.mocked(authApi.loginUser).mockResolvedValue(PATIENT);
    renderAuthPages('/login');

    await completeLogin();

    expect(await screen.findByText('Patient home')).toBeInTheDocument();
    expect(authApi.loginUser).toHaveBeenCalledWith({
      email: 'demo@example.com',
      password: 'password123',
    });
  });

  it('sends a doctor to the doctor dashboard', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.loginUser).mockResolvedValue(DOCTOR);
    renderAuthPages('/login');

    await user.click(doctorOption());
    await completeLogin('doctor@example.com');

    expect(await screen.findByText('Doctor home')).toBeInTheDocument();
  });

  it('rejects a role mismatch without signing the visitor in', async () => {
    // The account is a doctor account, but Patient was selected.
    vi.mocked(authApi.loginUser).mockResolvedValue(DOCTOR);
    renderAuthPages('/login');

    await completeLogin('doctor@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This is a doctor account. Select Doctor to sign in.',
    );
    expect(screen.queryByText('Doctor home')).not.toBeInTheDocument();
    expect(screen.queryByText('Patient home')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    // The cookie issued by the login call must not be kept.
    expect(authApi.logoutUser).toHaveBeenCalled();
  });

  it('keeps the existing field validation', async () => {
    const user = userEvent.setup();
    renderAuthPages('/login');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Please enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password.')).toBeInTheDocument();
    expect(authApi.loginUser).not.toHaveBeenCalled();
  });

  it('shows authentication errors', async () => {
    vi.mocked(authApi.loginUser).mockRejectedValue(new ApiError(401, 'Invalid email or password.'));
    renderAuthPages('/login');

    await completeLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.queryByText('Patient home')).not.toBeInTheDocument();
  });

  it('carries the selection into registration', async () => {
    const user = userEvent.setup();
    renderAuthPages('/login');

    await user.click(doctorOption());
    await user.click(screen.getByRole('link', { name: 'Create an account' }));

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(doctorOption()).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Registration role selection', () => {
  it('creates a patient account with no role field in the request', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.registerUser).mockResolvedValue(PATIENT);
    renderAuthPages('/register');

    await user.type(screen.getByLabelText('Name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Patient home')).toBeInTheDocument();
    expect(authApi.registerUser).toHaveBeenCalledWith({
      name: 'Asha Rao',
      email: 'asha@example.com',
      password: 'password123',
    });
  });

  it('explains doctor provisioning instead of showing the registration form', async () => {
    const user = userEvent.setup();
    renderAuthPages('/register');

    await user.click(doctorOption());

    expect(doctorOption()).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText('Doctor accounts are created by invitation', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
    expect(authApi.registerUser).not.toHaveBeenCalled();
  });

  it('returns to patient registration from the doctor notice', async () => {
    const user = userEvent.setup();
    renderAuthPages('/register');

    await user.click(doctorOption());
    await user.click(screen.getByRole('button', { name: 'Continue as a patient' }));

    expect(patientOption()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('keeps the existing registration validation', async () => {
    const user = userEvent.setup();
    renderAuthPages('/register');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Please enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your email.')).toBeInTheDocument();
    expect(authApi.registerUser).not.toHaveBeenCalled();
  });
});
