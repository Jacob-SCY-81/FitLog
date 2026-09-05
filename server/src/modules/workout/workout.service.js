import prisma from '../../lib/prisma.js';

/**
 * Create a workout record with exercise sets.
 */
export async function createWorkout({ startTime, endTime, notes, totalVolumeKg, exercises }, userId) {
  // Validate all exerciseIds belong to user or are official
  const exerciseIds = [...new Set(exercises.map(ex => ex.exerciseId))];
  const validExercises = await prisma.exercise.findMany({
    where: {
      id: { in: exerciseIds },
      deletedAt: null,
      OR: [
        { isOfficial: true },
        { createdById: userId },
      ],
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

  const workout = await prisma.workoutRecord.create({
    data: {
      userId,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      notes: notes || null,
      totalVolumeKg,
      exerciseSets: {
        create: exercises.flatMap(ex =>
          ex.sets.map(s => ({
            exerciseId: ex.exerciseId,
            sortOrder: ex.sortOrder,
            setIndex: s.setIndex,
            setType: s.setType,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe ?? null,
            completedAt: s.completedAt ? new Date(s.completedAt) : null,
            actualRestTimeSec: s.actualRestTimeSec,
            isCompleted: s.isCompleted,
          }))
        ),
      },
    },
    include: {
      exerciseSets: {
        include: {
          exercise: {
            select: { id: true, name: true, targetMuscle: true, equipment: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { setIndex: 'asc' }],
      },
    },
  });

  return workout;
}

/**
 * List user's workout history (paginated, newest first).
 */
export async function listWorkouts({ page, limit, startDate, endDate }, userId) {
  const where = { userId };

  if (startDate || endDate) {
    where.startTime = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.workoutRecord.findMany({
      where,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        notes: true,
        totalVolumeKg: true,
        createdAt: true,
        _count: { select: { exerciseSets: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startTime: 'desc' },
    }),
    prisma.workoutRecord.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * Get workout details with all exercise sets.
 */
export async function getWorkout(id, userId) {
  const workout = await prisma.workoutRecord.findUnique({
    where: { id },
    include: {
      exerciseSets: {
        include: {
          exercise: {
            select: { id: true, name: true, targetMuscle: true, equipment: true, mediaUrl: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { setIndex: 'asc' }],
      },
    },
  });

  if (!workout) {
    const err = new Error('Workout not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }

  if (workout.userId !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  return workout;
}

/**
 * Delete a workout record (cascades to exercise sets).
 */
export async function deleteWorkout(id, userId) {
  const workout = await prisma.workoutRecord.findUnique({ where: { id } });
  if (!workout) {
    const err = new Error('Workout not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  if (workout.userId !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  await prisma.workoutRecord.delete({ where: { id } });
}

/**
 * Update a workout (notes, endTime).
 * Only notes and endTime can be edited after submission to preserve data integrity.
 */
export async function updateWorkout(id, { notes, endTime }, userId) {
  const workout = await prisma.workoutRecord.findUnique({ where: { id } });
  if (!workout) {
    const err = new Error('Workout not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  if (workout.userId !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  const updated = await prisma.workoutRecord.update({
    where: { id },
    data: {
      ...(notes !== undefined ? { notes } : {}),
      ...(endTime ? { endTime: new Date(endTime) } : {}),
    },
    include: {
      exerciseSets: {
        include: {
          exercise: {
            select: { id: true, name: true, targetMuscle: true, equipment: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { setIndex: 'asc' }],
      },
    },
  });
  return updated;
}
