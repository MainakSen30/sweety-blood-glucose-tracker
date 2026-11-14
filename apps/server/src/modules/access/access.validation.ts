import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Email must be a valid email address')
    .max(255, 'Email must be 255 characters or fewer'),
});

export const acceptInvitationSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, 'Please provide a valid invitation token.')
    .max(200, 'Please provide a valid invitation token.'),
});

export const assignmentIdParamSchema = z.uuid({
  error: 'Please provide a valid relationship id.',
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
