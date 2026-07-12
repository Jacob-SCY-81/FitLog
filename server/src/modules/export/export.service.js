import prisma from '../../lib/prisma.js';

// Rate limit tracking (in-memory)
const exportRateMap = new Map(); // userId → { count, resetAt }

function checkExportRateLimit(userId) {
  const now = Date.now();
  let entry = exportRateMap.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + 24 * 60 * 60 * 1000 };
    exportRateMap.set(userId, entry);
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function checkRateLimit(userId) {
  if (!checkExportRateLimit(userId)) {
    const err = new Error('Export limit reached (3 per day). Try again tomorrow.');
    err.statusCode = 429;
    err.errorCode = 'EXPORT_LIMITED';
    throw err;
  }
}

export async function exportJSON(userId) {
  const sets = await prisma.exerciseSet.findMany({
    where: { workout: { userId } },
    include: {
      workout: { select: { startTime: true, endTime: true, notes: true } },
      exercise: { select: { name: true, targetMuscle: true, equipment: true } },
    },
    orderBy: [{ workout: { startTime: 'desc' } }, { sortOrder: 'asc' }, { setIndex: 'asc' }],
  });

  // Group by workout
  const workouts = [];
  const workoutMap = new Map();

  sets.forEach(s => {
    const wkId = s.workoutRecordId;
    if (!workoutMap.has(wkId)) {
      const wk = {
        startTime: s.workout.startTime,
        endTime: s.workout.endTime,
        notes: s.workout.notes,
        exercises: [],
      };
      workoutMap.set(wkId, wk);
      workouts.push(wk);
    }
    const wk = workoutMap.get(wkId);

    let exGroup = wk.exercises.find(e => e.exerciseId === s.exerciseId);
    if (!exGroup) {
      exGroup = {
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        targetMuscle: s.exercise.targetMuscle,
        equipment: s.exercise.equipment,
        sortOrder: s.sortOrder,
        sets: [],
      };
      wk.exercises.push(exGroup);
    }
    exGroup.sets.push({
      setIndex: s.setIndex,
      setType: s.setType,
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe,
      completedAt: s.completedAt,
      actualRestTimeSec: s.actualRestTimeSec,
      isCompleted: s.isCompleted,
    });
  });

  return workouts;
}

export function formatCSV(workouts) {
  const header = 'Date,Exercise,Muscle,Equipment,Set,Type,Weight(kg),Reps,RPE,Completed,Rest(s)';
  const rows = [];

  workouts.forEach(w => {
    const date = new Date(w.startTime).toISOString().split('T')[0];
    w.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        rows.push([
          date,
          `"${ex.exerciseName}"`,
          ex.targetMuscle,
          ex.equipment || '',
          s.setIndex,
          s.setType,
          s.weight,
          s.reps,
          s.rpe ?? '',
          s.isCompleted ? 'Yes' : 'No',
          s.actualRestTimeSec,
        ].join(','));
      });
    });
  });

  return [header, ...rows].join('\n');
}
