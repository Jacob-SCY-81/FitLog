import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

async function clean() {
  try {
    // 1. 重置 admin 测试账号手机号绑定
    await prisma.user.updateMany({
      where: { email: 'admin@admin' },
      data: { phone: null, phoneVerifiedAt: null },
    });

    // 2. 清理 E2E 测试专用号段用户及关联数据
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { phone: { startsWith: '+861380000' } },
          { phone: { startsWith: '+861390000' } },
          { phone: { in: ['+8613812345678', '+8613888886666', '+8613912345678', '+8613999999999'] } },
        ],
      },
    });

    for (const u of testUsers) {
      if (u.email !== 'admin@admin') {
        await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
        await prisma.workoutRecord.deleteMany({ where: { userId: u.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: u.id } });
      }
    }
  } catch (err) {
    console.error('Clean E2E data error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
