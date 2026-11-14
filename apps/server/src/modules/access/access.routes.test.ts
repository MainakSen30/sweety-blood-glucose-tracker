import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { db } from '../../database/index.js';
import { closeTestPool, resetDatabase } from '../../../tests/database.js';
import { promoteUserToDoctor } from '../../scripts/promote-doctor.js';

interface Session {
  userId: string;
  email: string;
  cookie: string;
}

interface TestResponseHeaders {
  'set-cookie'?: string | string[];
}

function authCookieFrom(response: { headers: TestResponseHeaders }): string {
  const cookies = response.headers['set-cookie'];
  const list = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  const cookie = list.find((value) => value.startsWith('sweety_access_token='));

  if (!cookie) {
    throw new Error('Authentication cookie was not returned.');
  }

  return cookie.split(';')[0] ?? '';
}

async function register(email: string, name = 'Test User'): Promise<Session> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'SecurePassword123' });

  expect(response.status).toBe(201);

  return { userId: response.body.id as string, email, cookie: authCookieFrom(response) };
}

async function registerDoctor(email: string, name = 'Dr. Test'): Promise<Session> {
  const session = await register(email, name);
  const outcome = await promoteUserToDoctor(db, {
    email,
    changedBy: 'Access Test Operator',
  });
  expect(outcome.state).toBe('promoted');
  return session;
}

async function createReading(cookie: string, value = 110): Promise<string> {
  const response = await request(app)
    .post('/api/readings')
    .set('Cookie', cookie)
    .send({ readingDate: '15-01-2026', slot: 'morning', value });

  expect(response.status).toBe(201);
  return response.body.id as string;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeTestPool();
});

describe('role provisioning', () => {
  it('ignores a client-supplied role on public registration', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Sneaky',
      email: 'sneaky@example.com',
      password: 'SecurePassword123',
      role: 'doctor',
    });

    expect(response.status).toBe(201);
    expect(response.body.role).toBe('patient');
  });

  it('lets a freshly promoted doctor use the existing session cookie', async () => {
    const doctor = await registerDoctor('fresh-doctor@example.com');

    const response = await request(app).get('/api/doctor/patients').set('Cookie', doctor.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ patients: [] });
  });

  it('rejects doctor and patient routes for the wrong role', async () => {
    const patient = await register('role-patient@example.com');

    const doctorRoute = await request(app)
      .get('/api/doctor/patients')
      .set('Cookie', patient.cookie);
    expect(doctorRoute.status).toBe(403);

    const doctor = await registerDoctor('role-doctor@example.com');
    const patientRoute = await request(app)
      .get('/api/patient/doctors')
      .set('Cookie', doctor.cookie);
    expect(patientRoute.status).toBe(403);
  });
});

describe('doctor–patient consent lifecycle', () => {
  it('requires patient acceptance before any patient data is readable', async () => {
    const patient = await register('patient@example.com', 'Pat Ient');
    const doctor = await registerDoctor('doctor@example.com');
    await createReading(patient.cookie, 132);

    const invitation = await request(app)
      .post('/api/doctor/invitations')
      .set('Cookie', doctor.cookie)
      .send({ email: patient.email });

    expect(invitation.status).toBe(201);
    expect(invitation.body).toMatchObject({
      patient: { id: patient.userId, email: patient.email },
      status: 'pending',
    });
    expect(invitation.body.inviteToken).toEqual(expect.any(String));

    // Pending is not access.
    const beforeAccept = await request(app)
      .get(`/api/doctor/patients/${patient.userId}/readings`)
      .set('Cookie', doctor.cookie);
    expect(beforeAccept.status).toBe(404);

    const overview = await request(app).get('/api/patient/doctors').set('Cookie', patient.cookie);
    expect(overview.status).toBe(200);
    expect(overview.body.invitations).toHaveLength(1);
    expect(overview.body.invitations[0].assignmentId).toBe(invitation.body.assignmentId);

    const accepted = await request(app)
      .post('/api/patient/invitations/accept')
      .set('Cookie', patient.cookie)
      .send({ token: invitation.body.inviteToken });
    expect(accepted.status).toBe(200);

    const patients = await request(app).get('/api/doctor/patients').set('Cookie', doctor.cookie);
    expect(patients.status).toBe(200);
    expect(patients.body.patients).toHaveLength(1);
    expect(patients.body.patients[0].patient).toMatchObject({ id: patient.userId });

    const readings = await request(app)
      .get(`/api/doctor/patients/${patient.userId}/readings`)
      .set('Cookie', doctor.cookie);
    expect(readings.status).toBe(200);
    expect(readings.body.data).toHaveLength(1);
    expect(readings.body.data[0].value).toBe(132);

    const report = await request(app)
      .get(`/api/doctor/patients/${patient.userId}/reports/daily?date=15-01-2026`)
      .set('Cookie', doctor.cookie);
    expect(report.status).toBe(200);
    expect(report.body.summary.totalReadings).toBe(1);
  });

  it('does not accept a token that was not issued for this patient', async () => {
    const patient = await register('patient@example.com');
    const otherPatient = await register('other-patient@example.com');
    const doctor = await registerDoctor('doctor@example.com');

    const invitation = await request(app)
      .post('/api/doctor/invitations')
      .set('Cookie', doctor.cookie)
      .send({ email: patient.email });

    const response = await request(app)
      .post('/api/patient/invitations/accept')
      .set('Cookie', otherPatient.cookie)
      .send({ token: invitation.body.inviteToken });

    expect(response.status).toBe(404);
  });

  it('returns a generic 404 for unknown patient emails and refuses self-invites', async () => {
    const doctor = await registerDoctor('doctor@example.com');

    const unknown = await request(app)
      .post('/api/doctor/invitations')
      .set('Cookie', doctor.cookie)
      .send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(404);

    // A doctor account is not a patient account, so it is not discoverable.
    const self = await request(app)
      .post('/api/doctor/invitations')
      .set('Cookie', doctor.cookie)
      .send({ email: doctor.email });
    expect(self.status).toBe(404);
  });

  it('allows the patient to reject a pending invitation', async () => {
    const patient = await register('patient@example.com');
    const doctor = await registerDoctor('doctor@example.com');

    const invitation = await request(app)
      .post('/api/doctor/invitations')
      .set('Cookie', doctor.cookie)
      .send({ email: patient.email });

    const rejected = await request(app)
      .post(`/api/patient/invitations/${invitation.body.assignmentId}/reject`)
      .set('Cookie', patient.cookie);
    expect(rejected.status).toBe(200);

    const overview = await request(app).get('/api/patient/doctors').set('Cookie', patient.cookie);
    expect(overview.body.invitations).toHaveLength(0);
    expect(overview.body.doctors).toHaveLength(0);
  });

  it('revocation immediately blocks readings, reports, and pending job results', async () => {
    const patient = await register('patient@example.com');
    const doctor = await registerDoctor('doctor@example.com');
    await createReading(patient.cookie);

    const invitation = await request(app)
      .post('/api/doctor/invitations')
      .set('Cookie', doctor.cookie)
      .send({ email: patient.email });

    await request(app)
      .post('/api/patient/invitations/accept')
      .set('Cookie', patient.cookie)
      .send({ token: invitation.body.inviteToken });

    const revoked = await request(app)
      .delete(`/api/patient/doctors/${invitation.body.assignmentId}`)
      .set('Cookie', patient.cookie);
    expect(revoked.status).toBe(200);

    const readings = await request(app)
      .get(`/api/doctor/patients/${patient.userId}/readings`)
      .set('Cookie', doctor.cookie);
    expect(readings.status).toBe(404);

    const report = await request(app)
      .get(`/api/doctor/patients/${patient.userId}/reports/daily?date=15-01-2026`)
      .set('Cookie', doctor.cookie);
    expect(report.status).toBe(404);

    const patients = await request(app).get('/api/doctor/patients').set('Cookie', doctor.cookie);
    expect(patients.body.patients).toHaveLength(0);

    // The patient's own access is unaffected.
    const own = await request(app).get('/api/readings').set('Cookie', patient.cookie);
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);
  });

  it('forbids doctors from mutating readings and their own self-report routes', async () => {
    const doctor = await registerDoctor('doctor@example.com');

    const create = await request(app)
      .post('/api/readings')
      .set('Cookie', doctor.cookie)
      .send({ readingDate: '15-01-2026', slot: 'morning', value: 100 });
    expect(create.status).toBe(403);

    const selfReport = await request(app)
      .get('/api/reports/daily?date=15-01-2026')
      .set('Cookie', doctor.cookie);
    expect(selfReport.status).toBe(403);
  });
});
