import prisma from '../../lib/prisma.js';

/**
 * List user's workout templates.
 */
export async function listTemplates(userId) {
  const templates = await prisma.workoutTemplate.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { exercises: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return templates;
}

/**
 * Get a single template with all exercises.
 */
export async function getTemplate(id, userId) {
  const template = await prisma.workoutTemplate.findUnique({
    where: { id },
    include: {
      exercises: {
        include: {
          exercise: {
            select: { id: true, name: true, targetMuscle: true, equipment: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!template) {
    const err = new Error('Template not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  if (template.userId !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }
  return template;
}

/**
 * Create a new workout template.
 */
export async function createTemplate({ name, notes, exercises }, userId) {
  // Validate exercises exist
  const exerciseIds = [...new Set(exercises.map(e => e.exerciseId))];
  const validExercises = await prisma.exercise.findMany({
    where: {
      id: { in: exerciseIds },
      deletedAt: null,
      OR: [{ isOfficial: true }, { createdById: userId }],
    },
    select: { id: true },
  });
  const validIds = new Set(validExercises.map(e => e.id));
  const invalidIds = exerciseIds.filter(id => !validIds.has(id));
  if (invalidIds.length > 0) {
    const err = new Error(`Invalid exercise IDs: ${invalidIds.join(', ')}`);
    err.statusCode = 403;
    err.errorCode = 'INVALID_EXERCISE_IDS';
    throw err;
  }

  const template = await prisma.workoutTemplate.create({
    data: {
      userId,
      name,
      notes: notes || null,
      exercises: {
        create: exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          sortOrder: ex.sortOrder,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          targetWeight: ex.targetWeight,
          notes: ex.notes || null,
        })),
      },
    },
    include: {
      exercises: {
        include: {
          exercise: { select: { id: true, name: true, targetMuscle: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  return template;
}

/**
 * Delete a template.
 */
export async function deleteTemplate(id, userId) {
  const template = await prisma.workoutTemplate.findUnique({ where: { id } });
  if (!template) {
    const err = new Error('Template not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  if (template.userId !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  await prisma.workoutTemplate.delete({ where: { id } });
}

/**
 * Start workout from template — returns the same structure as a draft.
 */
export async function loadTemplateForWorkout(id, userId) {
  const template = await getTemplate(id, userId);
  return {
    templateName: template.name,
    notes: template.notes || '',
    exercises: template.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exercise.name,
      targetMuscle: ex.exercise.targetMuscle,
      sortOrder: ex.sortOrder,
      sets: Array.from({ length: ex.targetSets }, (_, i) => ({
        setIndex: i + 1,
        setType: 'standard',
        weight: ex.targetWeight || '',
        reps: ex.targetReps || '',
        rpe: null,
        isCompleted: false,
        completedAt: null,
        actualRestTimeSec: 0,
      })),
    })),
  };
}
