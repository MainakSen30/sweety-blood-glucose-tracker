import type { Request, Response } from 'express';
import { HttpError } from '../../utils/errors.js';
import { formatValidationIssues } from '../../utils/validation.js';
import { getReportJobResult, getReportJobStatus, submitReportJob } from '../../jobs/reportQueue.js';
import { getReading, listUserReadings } from '../readings/readings.service.js';
import { listReadingsQuerySchema, readingIdParamSchema } from '../readings/readings.validation.js';
import {
  getDailyReportCached,
  getMonthToDateReportCached,
  getPreviousMonthReportCached,
} from '../reports/reports.cache.js';
import { reportDateQuerySchema, reportJobSubmitSchema } from '../reports/reports.validation.js';
import { requireAuthorizedPatientId } from '../access/access.middleware.js';
import {
  createDoctorInvitation,
  getDoctorInvitations,
  getDoctorPatients,
} from '../access/access.service.js';
import { createInvitationSchema } from '../access/access.validation.js';

/**
 * Doctor-facing read-only API. Every `/patients/:patientId/*` route runs
 * behind `requireActivePatientAssignment`, so the patient id in the URL is
 * only ever used after the relationship has been proven active.
 */
function requireDoctorId(request: Request): string {
  const doctorId = request.authenticatedUserId;

  if (!doctorId) {
    throw new HttpError(401, 'Authentication required.');
  }

  return doctorId;
}

function jobIdParam(request: Request): string {
  const value: unknown = request.params.jobId;
  return typeof value === 'string' ? value : '';
}

export async function listPatients(request: Request, response: Response): Promise<Response> {
  const patients = await getDoctorPatients(requireDoctorId(request));
  return response.status(200).json({ patients });
}

export async function listInvitations(request: Request, response: Response): Promise<Response> {
  const invitations = await getDoctorInvitations(requireDoctorId(request));
  return response.status(200).json({ invitations });
}

export async function invitePatient(request: Request, response: Response): Promise<Response> {
  const parsed = createInvitationSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsed.error),
    });
  }

  const invitation = await createDoctorInvitation(requireDoctorId(request), parsed.data.email);
  return response.status(201).json(invitation);
}

export async function listPatientReadings(request: Request, response: Response): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const parsed = listReadingsQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsed.error),
    });
  }

  const result = await listUserReadings(patientId, parsed.data);
  return response.status(200).json(result);
}

export async function getPatientReading(request: Request, response: Response): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const parsedId = readingIdParamSchema.safeParse(request.params.readingId);

  if (!parsedId.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedId.error),
    });
  }

  const reading = await getReading(patientId, parsedId.data);
  return response.status(200).json(reading);
}

export async function dailyReport(request: Request, response: Response): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const doctorId = requireDoctorId(request);
  const parsed = reportDateQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsed.error),
    });
  }

  const report = await getDailyReportCached(patientId, parsed.data.date, doctorId);
  return response.status(200).json(report);
}

export async function monthToDateReport(request: Request, response: Response): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const doctorId = requireDoctorId(request);
  const parsed = reportDateQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsed.error),
    });
  }

  const report = await getMonthToDateReportCached(patientId, parsed.data.date, doctorId);
  return response.status(200).json(report);
}

export async function monthlyReport(request: Request, response: Response): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const doctorId = requireDoctorId(request);
  const report = await getPreviousMonthReportCached(patientId, doctorId);
  return response.status(200).json(report);
}

export async function submitPatientReportJob(
  request: Request,
  response: Response,
): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const doctorId = requireDoctorId(request);
  const parsed = reportJobSubmitSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsed.error),
    });
  }

  const submission = await submitReportJob(
    patientId,
    {
      reportType: parsed.data.reportType,
      ...(parsed.data.date !== undefined ? { date: parsed.data.date } : {}),
    },
    doctorId,
  );

  return response.status(202).json(submission);
}

export async function patientReportJobStatus(
  request: Request,
  response: Response,
): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const doctorId = requireDoctorId(request);
  const status = await getReportJobStatus(jobIdParam(request), doctorId, patientId);

  if (!status) {
    throw new HttpError(404, 'Report job not found.');
  }

  return response.status(200).json(status);
}

export async function patientReportJobResult(
  request: Request,
  response: Response,
): Promise<Response> {
  const patientId = requireAuthorizedPatientId(request);
  const doctorId = requireDoctorId(request);
  const outcome = await getReportJobResult(jobIdParam(request), doctorId, patientId);

  if (!outcome) {
    throw new HttpError(404, 'Report job not found.');
  }

  if (outcome.state === 'processing') {
    throw new HttpError(409, 'Report is still being generated.');
  }

  if (outcome.state === 'failed') {
    throw new HttpError(409, 'Report generation failed.');
  }

  return response.status(200).json(outcome.report);
}
