import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prisma from '../../lib/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Async-loaded exercises JSON with pre-built Map index for O(1) lookup
let _exercisesIndex = null;
let _exercisesLoaded = false;

async function ensureExercisesLoaded() {
  if (_exercisesLoaded) return;
  const raw = await readFile(
    join(__dirname, '..', '..', '..', '..', 'data', 'exercises.json'), 'utf-8'
  );
  const all = JSON.parse(raw);
  _exercisesIndex = new Map(all.map(e => [e.id, e]));
  _exercisesLoaded = true;
}

function getJsonExerciseById(id) {
  if (!_exercisesIndex) return null;
  return _exercisesIndex.get(id) || null;
}

/**
 * List exercises with pagination, search, and filter.
 * - Official exercises (isOfficial = true, deletedAt = null)
 * - User's own custom exercises (createdById = userId, deletedAt = null)
 */
export async function listExercises({ page, limit, search, muscle, equipment }, userId) {
  const where = {
    deletedAt: null,
    OR: [
      { isOfficial: true },
      { createdById: userId },
    ],
  };

  if (search) {
    // Case-insensitive search for MySQL (utf8mb4_unicode_ci collation handles this natively,
    // but we explicitly support it regardless of collation)
    where.name = { contains: search };
  }
  if (muscle) {
    where.targetMuscle = muscle;
  }
  if (equipment) {
    where.equipment = equipment;
  }

  const [data, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      select: {
        id: true,
        name: true,
        targetMuscle: true,
        equipment: true,
        mediaUrl: true,
        isOfficial: true,
        createdById: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ isOfficial: 'desc' }, { name: 'asc' }],
    }),
    prisma.exercise.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * Get exercise details (includes instructions for official exercises).
 * For official exercises, we read instructions from the JSON data file.
 * For custom exercises, we return stored basic fields plus optional notes.
 */
export async function getExercise(id, userId) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.deletedAt) {
    const err = new Error('Exercise not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  // Check access: official OR own custom
  if (!exercise.isOfficial && exercise.createdById !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  // Enrich official exercises with data from JSON (instructions, level, mechanic, images)
  if (exercise.isOfficial) {
    await ensureExercisesLoaded();
    const jsonEx = getJsonExerciseById(exercise.id);
    if (jsonEx) {
      return {
        ...exercise,
        instructions: jsonEx.instructions || [],
        level: jsonEx.level || null,
        mechanic: jsonEx.mechanic || null,
        force: jsonEx.force || null,
        category: jsonEx.category || null,
        primaryMuscles: jsonEx.primaryMuscles || [],
        secondaryMuscles: jsonEx.secondaryMuscles || [],
        images: (jsonEx.images || []).map(img => `/media/exercises/${img}`),
      };
    }
  }

  return exercise;
}

/**
 * Create a custom exercise for the current user.
 */
export async function createExercise({ name, targetMuscle, equipment, notes }, userId) {
  const exercise = await prisma.exercise.create({
    data: {
      name,
      targetMuscle,
      equipment: equipment || null,
      notes: notes || null,
      mediaUrl: null,
      isOfficial: false,
      createdById: userId,
    },
  });
  return exercise;
}

/**
 * Soft-delete a custom exercise. Only the owner can delete.
 * Checks if exercise has associated ExerciseSets — if so, soft-delete only (already handled by deletedAt).
 */
export async function deleteExercise(id, userId) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.deletedAt) {
    const err = new Error('Exercise not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  if (exercise.isOfficial) {
    const err = new Error('Cannot delete official exercises.');
    err.statusCode = 400;
    err.errorCode = 'CANNOT_DELETE_OFFICIAL';
    throw err;
  }
  if (exercise.createdById !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  // Check for associated records
  const setCount = await prisma.exerciseSet.count({ where: { exerciseId: id } });

  // Soft delete
  await prisma.exercise.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return { hasRecords: setCount > 0 };
}

/**
 * Get filter options (distinct muscles + equipment from official exercises).
 */
export async function getFilterOptions() {
  const [muscles, equipment] = await Promise.all([
    prisma.exercise.findMany({
      where: { isOfficial: true, deletedAt: null },
      select: { targetMuscle: true },
      distinct: ['targetMuscle'],
      orderBy: { targetMuscle: 'asc' },
    }),
    prisma.exercise.findMany({
      where: { isOfficial: true, deletedAt: null },
      select: { equipment: true },
      distinct: ['equipment'],
      orderBy: { equipment: 'asc' },
    }),
  ]);

  return {
    muscles: muscles.map(m => m.targetMuscle).filter(Boolean),
    equipment: equipment.map(e => e.equipment).filter(Boolean),
  };
}
