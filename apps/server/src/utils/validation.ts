import type { z } from 'zod';

export interface ValidationErrorDetail {
  path: string;
  message: string;
}

export function formatValidationIssues(error: z.ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
