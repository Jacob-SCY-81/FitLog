import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function clean() {
  console.log('=== FitLog 测试脏数据安全清洗流程 ===\n');

  const dirtyUserId = 'cmq1vgyd50000p9z4cuqt1fsm'; // admin@admin
  
  // 1. 查找候选数据
  const candidates = await prisma.exercise.findMany({
    where: {
      isOfficial: false,
      createdById: dirtyUserId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: {
          exerciseSets: true,
          favorites: true,
          templateExercises: true,
        },
      },
    },
  });

  console.log(`检索到待处理候选自定义动作数量: ${candidates.length}`);

  // 2. 严格引用分析（双重保障）
  const safeToClean = [];
  const blocked = [];

  for (const item of candidates) {
    const totalRefs =
      item._count.exerciseSets +
      item._count.favorites +
      item._count.templateExercises;
    if (totalRefs === 0) {
      safeToClean.push(item);
    } else {
      blocked.push(item);
    }
  }

  console.log(`0 引用安全清理项: ${safeToClean.length}`);
  console.log(`存在业务引用保留项: ${blocked.length}`);

  if (blocked.length > 0) {
    console.warn('警告：发现存在引用的记录，已阻断其清理！', blocked.map(b => b.id));
  }

  if (safeToClean.length === 0) {
    console.log('无需要清理的脏数据，退出。');
    return;
  }

  // 3. 完整离线数据导出备份
  const backupPath = path.join(__dirname, '..', '..', 'scratch', 'backup-dirty-exercises.json');
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(safeToClean, null, 2), 'utf8');
  console.log(`已成功将 ${safeToClean.length} 条数据备份至: ${backupPath}`);

  // 4. 执行安全软删除（更新 deletedAt）
  const targetIds = safeToClean.map(ex => ex.id);
  const now = new Date();

  // 分批更新以防超过 SQL 参数限制
  const BATCH_SIZE = 500;
  let updatedCount = 0;

  for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
    const batch = targetIds.slice(i, i + BATCH_SIZE);
    const result = await prisma.exercise.updateMany({
      where: {
        id: { in: batch },
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    });
    updatedCount += result.count;
  }

  console.log(`成功对 ${updatedCount} 条测试数据执行软删除 (deletedAt = ${now.toISOString()})。`);

  // 5. 验证清理后状态
  const activeCustom = await prisma.exercise.count({
    where: { isOfficial: false, deletedAt: null },
  });
  const deletedCustom = await prisma.exercise.count({
    where: { isOfficial: false, NOT: { deletedAt: null } },
  });

  console.log('\n=== 清洗后自定义动作统计 ===');
  console.log(`活跃自定义动作: ${activeCustom}`);
  console.log(`软删除自定义动作: ${deletedCustom}`);
}

clean()
  .catch(e => {
    console.error('清洗脚本异常:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
