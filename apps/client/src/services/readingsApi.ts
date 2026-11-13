import { apiFetch } from './http.js';
import type {
  CreateReadingInput,
  ListReadingsFilters,
  PaginatedReadings,
  Reading,
  ReadingSlot,
  UpdateReadingInput,
} from '../types/reading.js';

/**
 * Typed blood glucose reading API client.
 *
 * Uses the same cookie-based, same-origin HTTP client as authentication. No
 * tokens are stored in web storage.
 */
export function createReading(input: CreateReadingInput): Promise<Reading> {
  return apiFetch<Reading>('/api/readings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listReadings(filters: ListReadingsFilters = {}): Promise<PaginatedReadings> {
  const query = new URLSearchParams();

  if (filters.date !== undefined) {
    query.set('date', filters.date);
  }
  if (filters.from !== undefined) {
    query.set('from', filters.from);
  }
  if (filters.to !== undefined) {
    query.set('to', filters.to);
  }
  if (filters.page !== undefined) {
    query.set('page', String(filters.page));
  }
  if (filters.limit !== undefined) {
    query.set('limit', String(filters.limit));
  }

  const queryString = query.toString();
  const path = queryString ? `/api/readings?${queryString}` : '/api/readings';

  return apiFetch<PaginatedReadings>(path);
}

/**
 * Walks every page of a filtered list. Used by the reports charts, which need
 * the whole period rather than one page of it.
 */
export async function listAllReadings(filters: ListReadingsFilters = {}): Promise<Reading[]> {
  const readings: Reading[] = [];
  let page = 1;
  let totalPages: number;

  do {
    const result = await listReadings({ ...filters, page, limit: 100 });
    readings.push(...result.data);
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return readings;
}

export function getReading(id: string): Promise<Reading> {
  return apiFetch<Reading>(`/api/readings/${encodeURIComponent(id)}`);
}

export function updateReading(id: string, input: UpdateReadingInput): Promise<Reading> {
  return apiFetch<Reading>(`/api/readings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteReading(id: string): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/api/readings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export type { ReadingSlot };
