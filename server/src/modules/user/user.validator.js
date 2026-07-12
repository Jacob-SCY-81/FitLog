import { z } from 'zod';

export const updateProfileSchema = z.object({
  nickname: z.string().min(1).max(50).nullable().optional(),
  avatarUrl: z.string().url().max(255).nullable().optional(),
});
