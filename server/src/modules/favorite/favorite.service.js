import prisma from '../../lib/prisma.js';

/**
 * List user's favorite exercises.
 */
export async function listFavorites(userId) {
  const favorites = await prisma.favoriteExercise.findMany({
    where: { userId },
    include: {
      exercise: {
        select: {
          id: true,
          name: true,
          targetMuscle: true,
          equipment: true,
          mediaUrl: true,
          isOfficial: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return favorites.map(f => f.exercise);
}

/**
 * Add an exercise to favorites.
 */
export async function addFavorite(exerciseId, userId) {
  // Verify exercise exists and is accessible
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise || exercise.deletedAt) {
    const err = new Error('Exercise not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }
  if (!exercise.isOfficial && exercise.createdById !== userId) {
    const err = new Error('Forbidden.');
    err.statusCode = 403;
    err.errorCode = 'FORBIDDEN';
    throw err;
  }

  const fav = await prisma.favoriteExercise.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    create: { userId, exerciseId },
    update: {},
  });
  return fav;
}

/**
 * Remove an exercise from favorites.
 */
export async function removeFavorite(exerciseId, userId) {
  try {
    await prisma.favoriteExercise.delete({
      where: { userId_exerciseId: { userId, exerciseId } },
    });
  } catch {
    // Already removed or doesn't exist — idempotent
  }
}

/**
 * Check if an exercise is favorited (returns array of exerciseIds).
 */
export async function getFavoriteIds(userId) {
  const favs = await prisma.favoriteExercise.findMany({
    where: { userId },
    select: { exerciseId: true },
  });
  return favs.map(f => f.exerciseId);
}
