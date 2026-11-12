import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../database/index.js';
import { readings } from '../../database/schema.js';

/**
 * Aggregate statistics straight from PostgreSQL. `average` stays a string
 * until the service converts it: PostgreSQL AVG over integers returns a
 * numeric, and the pg driver delivers numeric values as strings.
 */
export interface RawReadingAggregate {
  highest: number | null;
  lowest: number | null;
  average: string | null;
  totalReadings: number;
}

/**
 * Aggregates one user's readings between two inclusive ISO dates using SQL
 * MAX/MIN/AVG/COUNT, so the whole period is resolved in a single indexed
 * query and no other user's rows are ever touched.
 */
export async function aggregateUserReadings(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<RawReadingAggregate> {
  const [row] = await db
    .select({
      highest: sql<number | null>`max(${readings.value})`,
      lowest: sql<number | null>`min(${readings.value})`,
      average: sql<string | null>`avg(${readings.value})`,
      totalReadings: sql<number>`count(*)::int`,
    })
    .from(readings)
    .where(
      and(
        eq(readings.userId, userId),
        gte(readings.readingDate, startDate),
        lte(readings.readingDate, endDate),
      ),
    );

  return (
    row ?? {
      highest: null,
      lowest: null,
      average: null,
      totalReadings: 0,
    }
  );
}
