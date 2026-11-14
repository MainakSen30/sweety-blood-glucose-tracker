import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { HttpError } from '../../utils/errors.js';

const mockQueue = vi.hoisted(() => ({
  submitReportJob: vi.fn(),
  getReportJobStatus: vi.fn(),
  getReportJobResult: vi.fn(),
}));

vi.mock('../../jobs/reportQueue.js', () => ({
  submitReportJob: mockQueue.submitReportJob,
  getReportJobStatus: mockQueue.getReportJobStatus,
  getReportJobResult: mockQueue.getReportJobResult,
}));

// Mock auth so we can simulate authenticated users with different IDs without touching PostgreSQL
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const cookie = req.cookies?.sweety_access_token;
    const token = authHeader?.replace('Bearer ', '') || cookie;

    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    if (token === 'user-a-token') {
      req.authenticatedUserId = 'user-a-id';
      return next();
    }

    if (token === 'user-b-token') {
      req.authenticatedUserId = 'user-b-id';
      return next();
    }

    if (token === 'doctor-token') {
      req.authenticatedUserId = 'doctor-1-id';
      return next();
    }

    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  },
  // The route modules compose `requireRole`; this suite isolates the patient
  // endpoints and only needs the role gate to pass through.
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../access/access.middleware.js', () => ({
  requireActivePatientAssignment: (req: Request, _res: Response, next: NextFunction) => {
    const patientId = req.params.patientId;
    req.authorizedPatientId = typeof patientId === 'string' ? patientId : undefined;
    return next();
  },
  requireAuthorizedPatientId: (req: Request) =>
    req.authorizedPatientId ?? (typeof req.params.patientId === 'string' ? req.params.patientId : ''),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/reports/jobs — submission', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app)
      .post('/api/reports/jobs')
      .send({ reportType: 'daily', date: '15-01-2026' });

    expect(response.status).toBe(401);
    expect(mockQueue.submitReportJob).not.toHaveBeenCalled();
  });

  it('rejects invalid or missing reportType with 400', async () => {
    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'invalid-type', date: '15-01-2026' });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(mockQueue.submitReportJob).not.toHaveBeenCalled();
  });

  it('rejects daily report without date with 400', async () => {
    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'daily' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(mockQueue.submitReportJob).not.toHaveBeenCalled();
  });

  it('rejects month-to-date report without date with 400', async () => {
    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'month-to-date' });

    expect(response.status).toBe(400);
    expect(mockQueue.submitReportJob).not.toHaveBeenCalled();
  });

  it('submits a monthly report job with a historical date and returns 202', async () => {
    mockQueue.submitReportJob.mockResolvedValueOnce({
      jobId: 'rpt_user-a-id_monthly_2026-09-15',
      status: 'waiting',
    });

    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'monthly', date: '15-09-2026' });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      jobId: 'rpt_user-a-id_monthly_2026-09-15',
      status: 'waiting',
    });
    expect(mockQueue.submitReportJob).toHaveBeenCalledWith('user-a-id', {
      reportType: 'monthly',
      date: '2026-09-15',
    });
  });

  it('rejects monthly report with an impossible date with 400', async () => {
    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'monthly', date: '31-02-2026' });

    expect(response.status).toBe(400);
    expect(mockQueue.submitReportJob).not.toHaveBeenCalled();
  });

  it('rejects invalid date format with 400', async () => {
    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'daily', date: '2026-01-15' }); // expects DD-MM-YYYY

    expect(response.status).toBe(400);
    expect(mockQueue.submitReportJob).not.toHaveBeenCalled();
  });

  it('rejects future date with 400', async () => {
    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'daily', date: '01-01-2099' });

    expect(response.status).toBe(400);
    expect(mockQueue.submitReportJob).not.toHaveBeenCalled();
  });

  it('submits a valid daily report job with authenticated userId and returns 202', async () => {
    mockQueue.submitReportJob.mockResolvedValueOnce({
      jobId: 'rpt:user-a-id:daily:2026-01-15',
      status: 'waiting',
    });

    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({
        reportType: 'daily',
        date: '15-01-2026',
        userId: 'spoofed-user-id', // MUST be ignored
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      jobId: 'rpt:user-a-id:daily:2026-01-15',
      status: 'waiting',
    });

    // Validated payload converts DD-MM-YYYY (15-01-2026) to internal YYYY-MM-DD (2026-01-15)
    // and passes the authenticated userId, never the spoofed one.
    expect(mockQueue.submitReportJob).toHaveBeenCalledWith('user-a-id', {
      reportType: 'daily',
      date: '2026-01-15',
    });
  });

  it('submits a monthly report job without date and returns 202', async () => {
    mockQueue.submitReportJob.mockResolvedValueOnce({
      jobId: 'rpt:user-a-id:monthly:monthly',
      status: 'waiting',
    });

    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'monthly' });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      jobId: 'rpt:user-a-id:monthly:monthly',
      status: 'waiting',
    });
    expect(mockQueue.submitReportJob).toHaveBeenCalledWith('user-a-id', {
      reportType: 'monthly',
    });
  });

  it('returns 503 when queue submission fails due to Redis outage', async () => {
    mockQueue.submitReportJob.mockRejectedValueOnce(
      new HttpError(503, 'Report queue is unavailable. Please try again later.'),
    );

    const response = await request(app)
      .post('/api/reports/jobs')
      .set('Cookie', 'sweety_access_token=user-a-token')
      .send({ reportType: 'monthly' });

    expect(response.status).toBe(503);
    expect(response.body.message).toContain('unavailable');
  });
});

describe('GET /api/reports/jobs/:jobId — status lookup', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/reports/jobs/rpt:123');
    expect(response.status).toBe(401);
  });

  it('returns 404 for unknown or foreign-owned job', async () => {
    mockQueue.getReportJobStatus.mockResolvedValueOnce(null);

    const response = await request(app)
      .get('/api/reports/jobs/rpt:foreign-job')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(404);
    expect(mockQueue.getReportJobStatus).toHaveBeenCalledWith('rpt:foreign-job', 'user-a-id');
  });

  it('returns 200 with job status and progress for the owner', async () => {
    mockQueue.getReportJobStatus.mockResolvedValueOnce({
      jobId: 'rpt:user-a-id:daily:2026-01-15',
      status: 'active',
      progress: 50,
    });

    const response = await request(app)
      .get('/api/reports/jobs/rpt:user-a-id:daily:2026-01-15')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      jobId: 'rpt:user-a-id:daily:2026-01-15',
      status: 'active',
      progress: 50,
    });
  });

  it('returns 200 with failedReason when the job has failed', async () => {
    mockQueue.getReportJobStatus.mockResolvedValueOnce({
      jobId: 'rpt:user-a-id:daily:2026-01-15',
      status: 'failed',
      progress: 50,
      failedReason: 'Database connection failed',
    });

    const response = await request(app)
      .get('/api/reports/jobs/rpt:user-a-id:daily:2026-01-15')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('failed');
    expect(response.body.failedReason).toBe('Database connection failed');
  });

  it('returns 503 when queue status lookup encounters Redis outage', async () => {
    mockQueue.getReportJobStatus.mockRejectedValueOnce(
      new HttpError(503, 'Report queue is unavailable. Please try again later.'),
    );

    const response = await request(app)
      .get('/api/reports/jobs/rpt:user-a-id:daily:2026-01-15')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(503);
  });
});

describe('GET /api/reports/jobs/:jobId/result — result retrieval', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/reports/jobs/rpt:123/result');
    expect(response.status).toBe(401);
  });

  it('returns 404 for unknown or foreign-owned job', async () => {
    mockQueue.getReportJobResult.mockResolvedValueOnce(null);

    const response = await request(app)
      .get('/api/reports/jobs/rpt:foreign-job/result')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(404);
    expect(mockQueue.getReportJobResult).toHaveBeenCalledWith('rpt:foreign-job', 'user-a-id');
  });

  it('returns 409 Conflict when job is still processing', async () => {
    mockQueue.getReportJobResult.mockResolvedValueOnce({ state: 'processing' });

    const response = await request(app)
      .get('/api/reports/jobs/rpt:user-a-id:daily:2026-01-15/result')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Report is still being generated.');
  });

  it('returns 409 Conflict when job failed', async () => {
    mockQueue.getReportJobResult.mockResolvedValueOnce({
      state: 'failed',
      reason: 'Report generation failed.',
    });

    const response = await request(app)
      .get('/api/reports/jobs/rpt:user-a-id:daily:2026-01-15/result')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Report generation failed.');
  });

  it('returns 200 with the report when completed', async () => {
    const reportData = {
      reportType: 'daily',
      date: '15-01-2026',
      summary: { highest: 150, lowest: 100, average: 125, totalReadings: 2 },
      readings: [],
    };
    mockQueue.getReportJobResult.mockResolvedValueOnce({
      state: 'completed',
      report: reportData,
    });

    const response = await request(app)
      .get('/api/reports/jobs/rpt:user-a-id:daily:2026-01-15/result')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(reportData);
  });

  it('returns 503 when queue result lookup encounters Redis outage', async () => {
    mockQueue.getReportJobResult.mockRejectedValueOnce(
      new HttpError(503, 'Report queue is unavailable. Please try again later.'),
    );

    const response = await request(app)
      .get('/api/reports/jobs/rpt:user-a-id:daily:2026-01-15/result')
      .set('Cookie', 'sweety_access_token=user-a-token');

    expect(response.status).toBe(503);
  });
});

describe('POST /api/doctor/patients/:patientId/reports/jobs — doctor job submission', () => {
  it('submits a monthly report job for a patient with a historical date and returns 202', async () => {
    mockQueue.submitReportJob.mockResolvedValueOnce({
      jobId: 'rpt_doctor-1-id_418f430d-27f9-4e78-9e12-42111d4ebca5_monthly_2026-09-15',
      status: 'waiting',
    });

    const response = await request(app)
      .post('/api/doctor/patients/418f430d-27f9-4e78-9e12-42111d4ebca5/reports/jobs')
      .set('Cookie', 'sweety_access_token=doctor-token')
      .send({ reportType: 'monthly', date: '15-09-2026' });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      jobId: 'rpt_doctor-1-id_418f430d-27f9-4e78-9e12-42111d4ebca5_monthly_2026-09-15',
      status: 'waiting',
    });
    expect(mockQueue.submitReportJob).toHaveBeenCalledWith(
      '418f430d-27f9-4e78-9e12-42111d4ebca5',
      {
        reportType: 'monthly',
        date: '2026-09-15',
      },
      'doctor-1-id',
    );
  });
});
