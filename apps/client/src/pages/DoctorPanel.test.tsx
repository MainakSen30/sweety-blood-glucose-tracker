import type { ReactNode } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DoctorDashboardPage from './DoctorDashboardPage.js';
import DoctorPatientsPage from './DoctorPatientsPage.js';
import DoctorPatientPage from './DoctorPatientPage.js';
import DoctorInvitationsPage from './DoctorInvitationsPage.js';
import * as doctorApi from '../services/doctorApi.js';
import type {
  CreatedInvitation,
  DoctorInvitation,
  DoctorPatientLink,
} from '../services/doctorApi.js';
import type { PaginatedReadings } from '../types/reading.js';

vi.mock('../services/doctorApi', () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

function makeLink(id: string, name: string, email: string): DoctorPatientLink {
  return {
    assignmentId: `assignment-${id}`,
    acceptedAt: '2026-11-01T10:00:00.000Z',
    patient: { id, name, email },
  };
}

function makeInvitation(
  overrides: Partial<DoctorInvitation> & Pick<DoctorInvitation, 'assignmentId' | 'patient'>,
): DoctorInvitation {
  return {
    status: 'pending',
    invitedAt: '2026-11-10T10:00:00.000Z',
    expiresAt: '2026-11-17T10:00:00.000Z',
    acceptedAt: null,
    rejectedAt: null,
    revokedAt: null,
    expired: false,
    ...overrides,
  };
}

function renderPage(page: ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe('Doctor dashboard', () => {
  it('renders assigned patients, pending invitations, and consent dates', async () => {
    vi.mocked(doctorApi.listPatients).mockResolvedValue([
      makeLink('p1', 'Asha Rao', 'asha@example.com'),
    ]);
    vi.mocked(doctorApi.listInvitations).mockResolvedValue([
      makeInvitation({
        assignmentId: 'i1',
        patient: { id: 'p2', name: 'Ben Okafor', email: 'ben@example.com' },
      }),
    ]);

    renderPage(<DoctorDashboardPage />);

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText(/consent since 1 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText('Assigned patients')).toBeInTheDocument();
    expect(
      within(screen.getByText('Assigned patients').parentElement as HTMLElement).getByText('1'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ben Okafor')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  it('shows an empty state when no patient has consented', async () => {
    vi.mocked(doctorApi.listPatients).mockResolvedValue([]);
    vi.mocked(doctorApi.listInvitations).mockResolvedValue([]);

    renderPage(<DoctorDashboardPage />);

    expect(await screen.findByText('No patients assigned yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite a patient' })).toBeInTheDocument();
  });
});

describe('Doctor patient directory', () => {
  it('lists only the assigned patients returned by the API', async () => {
    vi.mocked(doctorApi.listPatients).mockResolvedValue([
      makeLink('p1', 'Asha Rao', 'asha@example.com'),
    ]);

    renderPage(<DoctorPatientsPage />);

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 patients')).toBeInTheDocument();
  });

  it('filters by name or email without another API request', async () => {
    const user = userEvent.setup();
    vi.mocked(doctorApi.listPatients).mockResolvedValue([
      makeLink('p1', 'Asha Rao', 'asha@example.com'),
      makeLink('p2', 'Ben Okafor', 'ben@example.com'),
    ]);

    renderPage(<DoctorPatientsPage />);

    await screen.findByText('Asha Rao');
    await user.type(screen.getByLabelText('Search patients'), 'ben');

    expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument();
    expect(screen.getByText('Ben Okafor')).toBeInTheDocument();
    expect(doctorApi.listPatients).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when the doctor has no assigned patients', async () => {
    vi.mocked(doctorApi.listPatients).mockResolvedValue([]);

    renderPage(<DoctorPatientsPage />);

    expect(await screen.findByText('No patients assigned yet')).toBeInTheDocument();
  });

  it('shows a retryable error when the directory request fails', async () => {
    vi.mocked(doctorApi.listPatients).mockRejectedValue(new Error('Authentication required.'));

    renderPage(<DoctorPatientsPage />);

    expect(await screen.findByText("We couldn't load your patients.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Doctor patient workspace', () => {
  const readings: PaginatedReadings = {
    data: [
      {
        id: 'r1',
        userId: 'p1',
        readingDate: '12-11-2026',
        slot: 'morning',
        value: 105,
        createdAt: '2026-11-12T10:30:00.000Z',
        updatedAt: '2026-11-12T10:30:00.000Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  it('renders readings and charts controls without edit or delete actions', async () => {
    vi.mocked(doctorApi.listPatients).mockResolvedValue([
      makeLink('p1', 'Asha Rao', 'asha@example.com'),
    ]);
    vi.mocked(doctorApi.listPatientReadings).mockResolvedValue(readings);

    render(
      <MemoryRouter initialEntries={['/doctor/patients/p1']}>
        <Routes>
          <Route path="/doctor/patients/:patientId" element={<DoctorPatientPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
    expect(await screen.findByText('Morning (fasting)')).toBeInTheDocument();
    expect(screen.getByText(/105/)).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by date')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();
  });

  it('explains what happened when patient data cannot be loaded', async () => {
    vi.mocked(doctorApi.listPatients).mockResolvedValue([
      makeLink('p1', 'Asha Rao', 'asha@example.com'),
    ]);
    vi.mocked(doctorApi.listPatientReadings).mockRejectedValue(new Error('Not found.'));

    render(
      <MemoryRouter initialEntries={['/doctor/patients/p1']}>
        <Routes>
          <Route path="/doctor/patients/:patientId" element={<DoctorPatientPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "We couldn't load this patient's data. Access may have been revoked.",
      ),
    ).toBeInTheDocument();
  });
});

describe('Doctor invitations', () => {
  const pending = makeInvitation({
    assignmentId: 'i1',
    patient: { id: 'p1', name: 'Asha Rao', email: 'asha@example.com' },
  });
  const accepted = makeInvitation({
    assignmentId: 'i2',
    status: 'active',
    acceptedAt: '2026-11-11T10:00:00.000Z',
    patient: { id: 'p2', name: 'Ben Okafor', email: 'ben@example.com' },
  });
  const expired = makeInvitation({
    assignmentId: 'i3',
    status: 'expired',
    expired: true,
    patient: { id: 'p3', name: 'Cara Singh', email: 'cara@example.com' },
  });
  const revoked = makeInvitation({
    assignmentId: 'i4',
    status: 'revoked',
    revokedAt: '2026-11-12T10:00:00.000Z',
    patient: { id: 'p4', name: 'Dan Meyer', email: 'dan@example.com' },
  });

  it('shows every invitation state and filters the history', async () => {
    const user = userEvent.setup();
    vi.mocked(doctorApi.listInvitations).mockResolvedValue([pending, accepted, expired, revoked]);

    renderPage(<DoctorInvitationsPage />);

    await screen.findByText('Asha Rao');
    expect(screen.getByText('Ben Okafor')).toBeInTheDocument();
    expect(screen.getByText('Cara Singh')).toBeInTheDocument();
    expect(screen.getByText('Dan Meyer')).toBeInTheDocument();

    const pendingRow = screen.getByText('Asha Rao').closest('li') as HTMLElement;
    expect(within(pendingRow).getByText('Pending')).toBeInTheDocument();
    const acceptedRow = screen.getByText('Ben Okafor').closest('li') as HTMLElement;
    expect(within(acceptedRow).getByText('Accepted')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Accepted/ }));

    expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument();
    expect(screen.getByText('Ben Okafor')).toBeInTheDocument();
    expect(screen.queryByText('Cara Singh')).not.toBeInTheDocument();
  });

  it('creates an invitation and reveals the token once', async () => {
    const user = userEvent.setup();
    const created: CreatedInvitation = {
      assignmentId: 'i-new',
      patient: { id: 'p9', name: 'New Patient', email: 'new@example.com' },
      status: 'pending',
      expiresAt: '2026-11-21T10:00:00.000Z',
      inviteToken: 'tok_once_only',
    };
    vi.mocked(doctorApi.listInvitations).mockResolvedValue([]);
    vi.mocked(doctorApi.invitePatient).mockResolvedValue(created);

    renderPage(<DoctorInvitationsPage />);
    await screen.findByText('No invitations sent yet.');

    await user.type(screen.getByLabelText('Patient email'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Create invitation' }));

    expect(doctorApi.invitePatient).toHaveBeenCalledWith('new@example.com');
    expect(await screen.findByText('tok_once_only')).toBeInTheDocument();
    expect(screen.getByText(/shown once/)).toBeInTheDocument();
  });

  it('shows a retryable error when invitations cannot load', async () => {
    vi.mocked(doctorApi.listInvitations).mockRejectedValue(new Error('Authentication required.'));

    renderPage(<DoctorInvitationsPage />);

    expect(await screen.findByText("We couldn't load your invitations.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
