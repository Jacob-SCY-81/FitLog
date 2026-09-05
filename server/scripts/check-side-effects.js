import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

async function checkSideEffects() {
  console.log('=== RefreshToken Side Effect Inspection ===');
  
  // 查找最近生成的 10 条 RefreshToken
  const tokens = await prisma.refreshToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    include: {
      user: {
        select: { id: true, email: true, phone: true },
      },
    },
  });

  console.table(tokens.map(t => ({
    id: t.id,
    userId: t.userId,
    userEmail: t.user?.email || '(null)',
    userPhone: t.user?.phone || '(null)',
    createdAt: t.createdAt.toISOString(),
    revokedAt: t.revokedAt ? t.revokedAt.toISOString() : 'ACTIVE',
    expiresAt: t.expiresAt.toISOString(),
  })));

  // 统计有多少处于 ACTIVE 状态的最近测试生成的 Token
  const now = new Date();
  const recentTestTokens = tokens.filter(t => {
    // 过去 30 分钟内创建的
    const diffMinutes = (now.getTime() - new Date(t.createdAt).getTime()) / (60 * 1000);
    return diffMinutes < 30;
  });

  console.log(`\n过去 30 分钟内测试生成的 RefreshToken 数量: ${recentTestTokens.length}`);
  const activeTestTokens = recentTestTokens.filter(t => !t.revokedAt);
  console.log(`其中未注销 (ACTIVE) 的测试 Token 数量: ${activeTestTokens.length}`);

  if (activeTestTokens.length > 0) {
    console.log('\n使用标准业务机制 (revokedAt: new Date()) 将其安全软失效...');
    for (const t of activeTestTokens) {
      await prisma.refreshToken.update({
        where: { id: t.id },
        data: { revokedAt: new Date() },
      });
      console.log(`  -> Token ${t.id} (user: ${t.user?.email || t.userId}) 已软失效`);
    }
  }

  const finalTotal = await prisma.refreshToken.count();
  const activeTotal = await prisma.refreshToken.count({ where: { revokedAt: null } });
  console.log(`\n最终 RefreshToken 总记录数: ${finalTotal} (历史物理记录完全保留，0 DELETE)`);
  console.log(`当前全库有效 (ACTIVE) RefreshToken 数量: ${activeTotal}`);

  await prisma.$disconnect();
}

checkSideEffects().catch(err => {
  console.error(err);
  process.exit(1);
});
