import { z } from 'zod';

export const createExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required').max(100),
  targetMuscle: z.string().min(1, 'Target muscle is required').max(50),
  equipment: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const updateExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required').max(100).optional(),
  targetMuscle: z.string().min(1, 'Target muscle is required').max(50).optional(),
  equipment: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const listExercisesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  muscle: z.string().optional(),
  equipment: z.string().optional(),
});
