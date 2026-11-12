/**
 * Helpers for interpreting PostgreSQL driver errors. Drizzle wraps driver
 * errors in a DrizzleQueryError, so the PostgreSQL error code may live on a
 * `cause` somewhere in the chain.
 */
function collectCauses(error: unknown): unknown[] {
  const causes: unknown[] = [error];

  let current: unknown = error;
  while (typeof current === 'object' && current !== null && 'cause' in current) {
    current = (current as { cause?: unknown }).cause;
    if (current === null || current === undefined) break;
    causes.push(current);
  }

  return causes;
}

function hasPostgresCode(error: unknown, code: string): boolean {
  return collectCauses(error).some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'code' in candidate &&
      (candidate as { code?: unknown }).code === code,
  );
}

/** PostgreSQL 23505 = unique_violation. */
export function isUniqueViolationError(error: unknown): boolean {
  return hasPostgresCode(error, '23505');
}

/** PostgreSQL 23514 = check_violation. */
export function isCheckViolationError(error: unknown): boolean {
  return hasPostgresCode(error, '23514');
}
