import prisma from '../../lib/prisma.js';
import { normalizePhone } from '../../lib/phone/normalize.js';
import { consumeVerificationCode } from '../../lib/verification/verification-code.service.js';

/**
 * Get user profile.
 */
export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
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
      phone: true,
      phoneVerifiedAt: true,
      nickname: true,
      avatarUrl: true,
    },
  });
  return user;
}

/**
 * 绑定手机号 (需要登录态)
 * @param {string} userId 当前登录用户 ID
 * @param {string} phone 待绑定的手机号
 * @param {string} code 6 位验证码
 */
export async function bindPhone(userId, phone, code) {
  // 1. 手机号严格规范化
  const normalizedPhone = normalizePhone(phone);

  // 2. 校验并核销验证码 (包含 5 次错误自动注销、成功即刻失效)
  const verifyResult = await consumeVerificationCode(normalizedPhone, code);
  if (!verifyResult.valid) {
    const err = new Error(verifyResult.error || 'Invalid verification code.');
    err.statusCode = 400;
    err.errorCode = verifyResult.errorCode || 'INVALID_CODE';
    throw err;
  }

  // 3. 事务保证：检查占用并完成绑定
  const updatedUser = await prisma.$transaction(async (tx) => {
    // 检查当前用户是否存在
    const currentUser = await tx.user.findUnique({
      where: { id: userId },
    });
    if (!currentUser) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      err.errorCode = 'USER_NOT_FOUND';
      throw err;
    }

    // 检查手机号是否已被其他用户绑定
    const phoneOwner = await tx.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (phoneOwner && phoneOwner.id !== userId) {
      const err = new Error('该手机号已被其他账号绑定');
      err.statusCode = 409;
      err.errorCode = 'PHONE_ALREADY_BOUND';
      throw err;
    }

    // 更新当前用户的 phone 与 phoneVerifiedAt (User.id 绝对不变，email 绝对不删)
    return tx.user.update({
      where: { id: userId },
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        nickname: true,
        avatarUrl: true,
      },
    });
  });

  return updatedUser;
}
