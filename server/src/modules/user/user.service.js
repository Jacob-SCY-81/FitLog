import prisma from '../../lib/prisma.js';

/**
 * Get user profile.
 */
export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: {
          workouts: true,
          favorites: true,
          customExercises: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    err.errorCode = 'NOT_FOUND';
    throw err;
  }

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    stats: {
      totalWorkouts: user._count.workouts,
      totalFavorites: user._count.favorites,
      totalCustomExercises: user._count.customExercises,
    },
  };
}

/**
 * Update user profile.
 */
export async function updateProfile(userId, { nickname, avatarUrl }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(nickname !== undefined ? { nickname } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
    },
  });
  return user;
}
