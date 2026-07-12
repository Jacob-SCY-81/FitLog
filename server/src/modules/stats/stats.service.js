import prisma from '../../lib/prisma.js';

/**
 * Get exercises that the user has used in workouts.
 */
export async function getExercisesUsed(userId) {
  const exercises = await prisma.exerciseSet.findMany({
    where: { workout: { userId } },
    select: {
      exercise: {
        select: { id: true, name: true, targetMuscle: true },
      },
    },
    distinct: ['exerciseId'],
    orderBy: { exercise: { name: 'asc' } },
  });

  return exercises.map(e => e.exercise);
}

/**
 * Get 1RM trend and rest time analysis for a specific exercise.
 * Epley formula: 1RM = weight × (1 + reps / 30)
 * Uses DB-level aggregation for performance, with JS fallback.
 */
export async function getExerciseStats(exerciseId, userId, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // DB-level aggregation using raw SQL (see PRD section 9.2)
    const [oneRmRows, restRows, summaryRows] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT
          DATE(es.completedAt) AS train_date,
          MAX(es.weight * (1 + es.reps / 30.0)) AS daily_max_1rm
        FROM ExerciseSet es
        JOIN WorkoutRecord wr ON es.workoutRecordId = wr.id
        WHERE
          wr.userId = ?
          AND es.exerciseId = ?
          AND es.reps >= 2
          AND es.isCompleted = TRUE
          AND es.completedAt >= ?
        GROUP BY DATE(es.completedAt)
        ORDER BY train_date ASC
      `, userId, exerciseId, since),
      prisma.$queryRawUnsafe(`
        SELECT
          DATE(es.completedAt) AS train_date,
          AVG(es.actualRestTimeSec) AS avg_rest_sec
        FROM ExerciseSet es
        JOIN WorkoutRecord wr ON es.workoutRecordId = wr.id
        WHERE
          wr.userId = ?
          AND es.exerciseId = ?
          AND es.isCompleted = TRUE
          AND es.actualRestTimeSec > 0
          AND es.completedAt >= ?
        GROUP BY DATE(es.completedAt)
        ORDER BY train_date ASC
      `, userId, exerciseId, since),
      prisma.$queryRawUnsafe(`
        SELECT
          MAX(es.weight * (1 + es.reps / 30.0)) AS best_1rm,
          COUNT(DISTINCT DATE(es.completedAt)) AS total_workouts,
          COUNT(*) AS total_sets
        FROM ExerciseSet es
        JOIN WorkoutRecord wr ON es.workoutRecordId = wr.id
        WHERE
          wr.userId = ?
          AND es.exerciseId = ?
          AND es.reps >= 2
          AND es.isCompleted = TRUE
          AND es.completedAt >= ?
      `, userId, exerciseId, since),
    ]);

    const oneRm = oneRmRows.map(r => ({
      date: r.train_date instanceof Date ? r.train_date.toISOString().split('T')[0] : String(r.train_date).split('T')[0],
      max1rm: Math.round(Number(r.daily_max_1rm) * 10) / 10,
    }));

    const restTime = restRows.map(r => ({
      date: r.train_date instanceof Date ? r.train_date.toISOString().split('T')[0] : String(r.train_date).split('T')[0],
      avgRestSec: Math.round(Number(r.avg_rest_sec)),
    }));

    const summary = summaryRows[0] || { best_1rm: 0, total_workouts: 0, total_sets: 0 };

    return {
      exerciseId,
      days,
      oneRm,
      restTime,
      best1rm: Math.round(Number(summary.best_1rm) * 10) / 10,
      totalWorkouts: Number(summary.total_workouts),
      totalSets: Number(summary.total_sets),
    };
  } catch (_dbErr) {
    // Fallback to JS-level aggregation for environments where raw SQL is unavailable
    return getExerciseStatsFallback(exerciseId, userId, days);
  }
}

/**
 * JS-level fallback: pulls all completed sets and aggregates in memory.
 * Used when $queryRaw is unavailable (e.g., some Prisma/DB driver combos).
 */
async function getExerciseStatsFallback(exerciseId, userId, days) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const sets = await prisma.exerciseSet.findMany({
    where: {
      exerciseId,
      workout: { userId },
      isCompleted: true,
      completedAt: { gte: since },
    },
    select: {
      weight: true,
      reps: true,
      completedAt: true,
      actualRestTimeSec: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const byDate = new Map();
  sets.forEach(s => {
    const date = s.completedAt.toISOString().split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, { oneRms: [], restTimes: [] });
    }
    const entry = byDate.get(date);
    if (s.reps >= 2) {
      entry.oneRms.push(s.weight * (1 + s.reps / 30));
    } else if (s.reps === 1) {
      entry.oneRms.push(s.weight);
    }
    if (s.actualRestTimeSec > 0) {
      entry.restTimes.push(s.actualRestTimeSec);
    }
  });

  const oneRm = [];
  const restTime = [];
  let best1rm = 0;
  let totalWorkouts = byDate.size;
  let totalSets = sets.length;

  byDate.forEach((entry, date) => {
    if (entry.oneRms.length > 0) {
      const max1rm = Math.max(...entry.oneRms);
      oneRm.push({ date, max1rm: Math.round(max1rm * 10) / 10 });
      if (max1rm > best1rm) best1rm = max1rm;
    }
    if (entry.restTimes.length > 0) {
      const avg = Math.round(entry.restTimes.reduce((a, b) => a + b, 0) / entry.restTimes.length);
      restTime.push({ date, avgRestSec: avg });
    }
  });

  return {
    exerciseId,
    days,
    oneRm,
    restTime,
    best1rm: Math.round(best1rm * 10) / 10,
    totalWorkouts,
    totalSets,
  };
}
