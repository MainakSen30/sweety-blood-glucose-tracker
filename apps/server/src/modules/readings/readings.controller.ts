import type { Request, Response } from 'express';
import { HttpError } from '../../utils/errors.js';
import { formatValidationIssues } from '../../utils/validation.js';
import {
  createReading,
  deleteUserReading,
  getReading,
  listUserReadings,
  updateUserReading,
} from './readings.service.js';
import {
  createReadingSchema,
  listReadingsQuerySchema,
  readingIdParamSchema,
  updateReadingSchema,
} from './readings.validation.js';

export async function create(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedInput = createReadingSchema.safeParse(request.body);

  if (!parsedInput.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedInput.error),
    });
  }

  const reading = await createReading(userId, parsedInput.data);
  return response.status(201).json(reading);
}

export async function list(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedQuery = listReadingsQuerySchema.safeParse(request.query);

  if (!parsedQuery.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedQuery.error),
    });
  }

  const readings = await listUserReadings(userId, parsedQuery.data);
  return response.status(200).json(readings);
}

export async function get(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedParams = readingIdParamSchema.safeParse(request.params.id);

  if (!parsedParams.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedParams.error),
    });
  }

  const reading = await getReading(userId, parsedParams.data);
  return response.status(200).json(reading);
}

export async function update(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedParams = readingIdParamSchema.safeParse(request.params.id);

  if (!parsedParams.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedParams.error),
    });
  }

  const parsedInput = updateReadingSchema.safeParse(request.body);

  if (!parsedInput.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedInput.error),
    });
  }

  const reading = await updateUserReading(userId, parsedParams.data, parsedInput.data);
  return response.status(200).json(reading);
}

export async function remove(request: Request, response: Response): Promise<Response> {
  const userId = requireUserId(request);
  const parsedParams = readingIdParamSchema.safeParse(request.params.id);

  if (!parsedParams.success) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation failed',
      details: formatValidationIssues(parsedParams.error),
    });
  }

  await deleteUserReading(userId, parsedParams.data);
  return response.status(200).json({ status: 'ok', message: 'Reading deleted successfully.' });
}

function requireUserId(request: Request): string {
  const userId = request.authenticatedUserId;

  if (!userId) {
    throw new HttpError(401, 'Authentication required.');
  }

  return userId;
}
