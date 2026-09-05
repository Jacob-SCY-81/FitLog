import { z } from 'zod';

const mediaUrlSchema = z.string().max(500).refine((val) => {
  if (!val) return true;
  return /^(https?:\/\/|\/media\/|\/images\/|\/assets\/)/i.test(val);
}, {
  message: 'Invalid media URL. Must be an HTTP(S) link or valid media path',
}).nullable().optional();

export const createExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required').max(100),
  targetMuscle: z.string().min(1, 'Target muscle is required').max(50),
  equipment: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  mediaUrl: mediaUrlSchema,
});

export const updateExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required').max(100).optional(),
  targetMuscle: z.string().min(1, 'Target muscle is required').max(50).optional(),
  equipment: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  mediaUrl: mediaUrlSchema,
});

export const listExercisesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  muscle: z.string().optional(),
  equipment: z.string().optional(),
});
