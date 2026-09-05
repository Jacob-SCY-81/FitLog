import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

async function clean() {
  try {
    await prisma.user.updateMany({
      where: { email: 'admin@admin' },
      data: { phone: null, phoneVerifiedAt: null },
    });

    const tempUsers = await prisma.user.findMany({
      where: {
        phone: {
          in: ['+8613812345678', '+8613888886666'],
        },
      },
    });

    for (const u of tempUsers) {
      if (u.email !== 'admin@admin') {
        await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
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
