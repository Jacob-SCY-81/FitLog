import { z } from 'zod';

export const updateProfileSchema = z.object({
  nickname: z.string().min(1).max(50).nullable().optional(),
  avatarUrl: z.string().url().max(255).nullable().optional(),
});

export const bindPhoneSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});
