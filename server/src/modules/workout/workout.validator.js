import { z } from 'zod';

const setSchema = z.object({
  exerciseId: z.string().min(1),
  sortOrder: z.number().int().min(1),
  setIndex: z.number().int().min(1),
  setType: z.enum(['warmup', 'standard', 'dropset', 'failure']).default('standard'),
  weight: z.number().min(0),
  reps: z.number().int().min(0),
  rpe: z.number().min(0).max(10).multipleOf(0.5).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  actualRestTimeSec: z.number().int().min(0).default(0),
  isCompleted: z.boolean().default(false),
});

export const createWorkoutSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  totalVolumeKg: z.number().min(0).default(0),
  exercises: z.array(z.object({
    exerciseId: z.string().min(1),
    sortOrder: z.number().int().min(1),
    sets: z.array(setSchema).min(1),
  })).min(1),
});

export const updateWorkoutSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
});

export const listWorkoutsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
