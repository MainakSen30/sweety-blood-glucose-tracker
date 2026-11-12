import { HttpError } from '../../utils/errors.js';
import {
  countReadingsForDate,
  deleteReading,
  findReadingById,
  insertReading,
  listReadings,
  updateReading,
  type ListReadingsFilters,
} from './readings.repository.js';
import { DAILY_LIMIT_MESSAGE } from './readings.messages.js';
import type {
  CreateReadingInput,
  ListReadingsQuery,
  UpdateReadingInput,
} from './readings.validation.js';
import { toReadingDto, type ReadingDto, type ReadingSlot } from './readings.types.js';

const MAX_READINGS_PER_DAY = 4;
const READING_NOT_FOUND_MESSAGE = 'Reading not found.';

export async function createReading(
  userId: string,
  input: CreateReadingInput,
): Promise<ReadingDto> {
  const existingCount = await countReadingsForDate(userId, input.readingDate);

  if (existingCount >= MAX_READINGS_PER_DAY) {
    throw new HttpError(409, DAILY_LIMIT_MESSAGE);
  }

  const reading = await insertReading({
    userId,
    readingDate: input.readingDate,
    slot: input.slot,
    value: input.value,
  });

  return toReadingDto(reading);
}

export async function listUserReadings(
  userId: string,
  query: ListReadingsQuery,
): Promise<ReadingDto[]> {
  const filters: ListReadingsFilters = {};

  if (query.date !== undefined) {
    filters.date = query.date;
  }
  if (query.from !== undefined) {
    filters.from = query.from;
  }
  if (query.to !== undefined) {
    filters.to = query.to;
  }

  const readings = await listReadings(userId, filters);

  return readings.map(toReadingDto);
}

export async function getReading(userId: string, id: string): Promise<ReadingDto> {
  const reading = await findReadingById(id, userId);

  if (!reading) {
    throw new HttpError(404, READING_NOT_FOUND_MESSAGE);
  }

  return toReadingDto(reading);
}

export async function updateUserReading(
  userId: string,
  id: string,
  input: UpdateReadingInput,
): Promise<ReadingDto> {
  const existing = await findReadingById(id, userId);

  if (!existing) {
    throw new HttpError(404, READING_NOT_FOUND_MESSAGE);
  }

  const nextDate = input.readingDate ?? existing.readingDate;
  const nextSlot: ReadingSlot = input.slot ?? existing.slot;

  // When the reading moves to another day, the target day must not already
  // hold four other readings.
  if (input.readingDate !== undefined && input.readingDate !== existing.readingDate) {
    const targetDateCount = await countReadingsForDate(userId, nextDate, { excludeId: id });

    if (targetDateCount >= MAX_READINGS_PER_DAY) {
      throw new HttpError(409, DAILY_LIMIT_MESSAGE);
    }
  }

  const updated = await updateReading(
    id,
    userId,
    {
      readingDate: input.readingDate,
      slot: input.slot,
      value: input.value,
    },
    nextSlot,
  );

  if (!updated) {
    throw new HttpError(404, READING_NOT_FOUND_MESSAGE);
  }

  return toReadingDto(updated);
}

export async function deleteUserReading(userId: string, id: string): Promise<void> {
  const deleted = await deleteReading(id, userId);

  if (!deleted) {
    throw new HttpError(404, READING_NOT_FOUND_MESSAGE);
  }
}
