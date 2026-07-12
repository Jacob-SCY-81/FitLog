import { z } from 'zod';

export const createMeasurementSchema = z.object({
  date: z.string().datetime().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  bodyFatPct: z.number().min(0).max(60).nullable().optional(),
  chestCm: z.number().positive().max(200).nullable().optional(),
  waistCm: z.number().positive().max(200).nullable().optional(),
  hipCm: z.number().positive().max(200).nullable().optional(),
  armCm: z.number().positive().max(100).nullable().optional(),
  thighCm: z.number().positive().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const listMeasurementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
