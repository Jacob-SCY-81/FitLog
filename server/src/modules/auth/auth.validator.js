import { z } from 'zod';

export const sendCodeSchema = z.object({
  email: z.string().refine(
    (v) => v === 'admin@admin' || z.string().email().safeParse(v).success,
    'Invalid email address'
  ),
});

export const loginSchema = z.object({
  email: z.string().refine(
    (v) => v === 'admin@admin' || z.string().email().safeParse(v).success,
    'Invalid email address'
  ),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const sendPhoneCodeSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
});

export const phoneLoginSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});
