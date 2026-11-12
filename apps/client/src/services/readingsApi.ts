import { apiFetch } from './http.js';
import type {
  CreateReadingInput,
  ListReadingsFilters,
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

export function listReadings(filters: ListReadingsFilters = {}): Promise<Reading[]> {
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

  const queryString = query.toString();
  const path = queryString ? `/api/readings?${queryString}` : '/api/readings';

  return apiFetch<Reading[]>(path);
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
