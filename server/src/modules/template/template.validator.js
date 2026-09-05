import { z } from 'zod';

export const templateExerciseItemSchema = z.object({
  exerciseId: z.string().min(1),
  sortOrder: z.number().int().min(1),
  targetSets: z.number().int().min(1).max(20).default(3),
  targetReps: z.number().int().min(1).max(100).default(10),
  targetWeight: z.number().min(0).default(0),
  notes: z.string().max(200).nullable().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  notes: z.string().max(2000).nullable().optional(),
  exercises: z.array(templateExerciseItemSchema).min(1),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(2000).nullable().optional(),
  exercises: z.array(templateExerciseItemSchema).min(1).optional(),
});
