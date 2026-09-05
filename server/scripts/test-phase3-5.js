import prisma from '../src/lib/prisma.js';
import {
  getOverviewStats,
  getExercisesUsed,
  getExerciseStats,
} from '../src/modules/stats/stats.service.js';
import { createWorkout } from '../src/modules/workout/workout.service.js';

async function runTests() {
  console.log('=== FitLog Phase 3.5: 训练数据统计与分析系统全景测试 ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      failed++;
    }
  }

  // 1. 准备测试用户
  const testSuffix = Date.now().toString().slice(-4);
  const userA = await prisma.user.create({
    data: { email: `stats-user-a-${testSuffix}@fitlog.dev`, nickname: 'StatsUserA' },
  });
  const userB = await prisma.user.create({
    data: { email: `stats-user-b-${testSuffix}@fitlog.dev`, nickname: 'StatsUserB' },
  });

  // 获取两个官方动作
  const exercises = await prisma.exercise.findMany({
    where: { isOfficial: true, deletedAt: null },
    take: 2,
  });

  const createdWorkoutIds = [];

  try {
    // -------------------------------------------------------------
    console.log('--- 1. 准备多周期训练历史数据 ---');
    // -------------------------------------------------------------
    const now = new Date();
    // 记录1: 昨天，时长 60 分钟，推胸 3 组 (60kg*10, 70kg*8, 80kg*6)
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const yesterdayEnd = new Date(yesterday.getTime() + 60 * 60 * 1000);
    const w1 = await createWorkout({
      startTime: yesterday.toISOString(),
      endTime: yesterdayEnd.toISOString(),
      notes: '昨日胸部大重量突破',
      totalVolumeKg: 60 * 10 + 70 * 8 + 80 * 6, // 600 + 560 + 480 = 1640
      exercises: [
        {
          exerciseId: exercises[0].id,
          sortOrder: 1,
          sets: [
            { setIndex: 1, setType: 'standard', weight: 60, reps: 10, rpe: 8.0, completedAt: yesterday.toISOString(), actualRestTimeSec: 60, isCompleted: true },
            { setIndex: 2, setType: 'standard', weight: 70, reps: 8, rpe: 8.5, completedAt: yesterday.toISOString(), actualRestTimeSec: 90, isCompleted: true },
            { setIndex: 3, setType: 'standard', weight: 80, reps: 6, rpe: 9.5, completedAt: yesterday.toISOString(), actualRestTimeSec: 120, isCompleted: true },
          ],
        },
      ],
    }, userA.id);
    createdWorkoutIds.push(w1.id);

    // 记录2: 今天，时长 45 分钟，动作2 2 组 (50kg*12, 55kg*10)
    const todayEnd = new Date(now.getTime() + 45 * 60 * 1000);
    const w2 = await createWorkout({
      startTime: now.toISOString(),
      endTime: todayEnd.toISOString(),
      notes: '今日补充训练',
      totalVolumeKg: 50 * 12 + 55 * 10, // 600 + 550 = 1150
      exercises: [
        {
          exerciseId: exercises[1].id,
          sortOrder: 1,
          sets: [
            { setIndex: 1, setType: 'standard', weight: 50, reps: 12, rpe: 7.5, completedAt: now.toISOString(), actualRestTimeSec: 60, isCompleted: true },
            { setIndex: 2, setType: 'standard', weight: 55, reps: 10, rpe: 8.5, completedAt: now.toISOString(), actualRestTimeSec: 75, isCompleted: true },
          ],
        },
      ],
    }, userA.id);
    createdWorkoutIds.push(w2.id);

    // 用户 B 的无关记录（验证隔离）
    const wB = await createWorkout({
      startTime: now.toISOString(),
      endTime: todayEnd.toISOString(),
      notes: '用户B私有训练',
      totalVolumeKg: 9999,
      exercises: [
        {
          exerciseId: exercises[0].id,
          sortOrder: 1,
          sets: [{ setIndex: 1, setType: 'standard', weight: 200, reps: 10, completedAt: now.toISOString(), actualRestTimeSec: 60, isCompleted: true }],
        },
      ],
    }, userB.id);
    createdWorkoutIds.push(wB.id);

    assert(createdWorkoutIds.length === 3, '成功创建测试训练数据样本');

    // -------------------------------------------------------------
    console.log('\n--- 2. 全局概览统计 (Overview Stats) 测试 ---');
    // -------------------------------------------------------------
    const overview = await getOverviewStats(userA.id, 30);
    assert(overview.totalWorkouts === 2, '用户 A 近 30 天总训练次数为 2');
    assert(overview.totalVolumeKg === 1640 + 1150, '总训练容量精确累加 (2790 kg)');
    assert(overview.totalDurationMinutes === 60 + 45, '总训练时长精确汇总 (105 分钟)');
    assert(overview.totalSets === 5, '总训练组数精确为 5 组');
    assert(overview.totalReps === (10 + 8 + 6 + 12 + 10), '总训练次数精确为 46 次');
    assert(Array.isArray(overview.volumeTrend) && overview.volumeTrend.length >= 2, '生成容量按日趋势折线数据');
    assert(Array.isArray(overview.muscleDistribution) && overview.muscleDistribution.length > 0, '生成肌肉群训练分布数据');
    const totalPct = overview.muscleDistribution.reduce((s, m) => s + m.percentage, 0);
    assert(totalPct >= 95 && totalPct <= 105, '各肌群训练占比归一化正确');

    // -------------------------------------------------------------
    console.log('\n--- 3. 动作使用列表与 1RM 渐进趋势测试 ---');
    // -------------------------------------------------------------
    const usedList = await getExercisesUsed(userA.id);
    assert(usedList.length === 2, '正确识别出用户 A 使用过的 2 个动作');
    assert(usedList.some(e => e.id === exercises[0].id), '包含首个动作');
    assert(usedList.some(e => e.id === exercises[1].id), '包含第二个动作');

    const exStats = await getExerciseStats(exercises[0].id, userA.id, 30);
    assert(exStats.exerciseId === exercises[0].id, '单动作统计正确');
    assert(exStats.totalSets === 3, '该动作完成总组数为 3');
    // Epley: 80 * (1 + 6/30) = 80 * 1.2 = 96.0
    assert(exStats.best1rm === 96.0, `最佳 1RM 精确计算 (期望 96.0kg，实际 ${exStats.best1rm}kg)`);
    assert(exStats.oneRm.length >= 1, '生成 1RM 渐进负荷历史折线点');
    assert(exStats.restTime.length >= 1, '生成平均组间休息历史点');

    // -------------------------------------------------------------
    console.log('\n--- 4. 租户隔离与越权校验 (Tenant Isolation) 测试 ---');
    // -------------------------------------------------------------
    const overviewB = await getOverviewStats(userB.id, 30);
    assert(overviewB.totalWorkouts === 1, '用户 B 概览仅包含其自己的 1 次训练');
    assert(overviewB.totalVolumeKg === 9999, '用户 B 容量统计严格隔离');

    // 用户 B 查看其未做过的动作统计
    const exStatsB = await getExerciseStats(exercises[1].id, userB.id, 30);
    assert(exStatsB.totalSets === 0 && exStatsB.best1rm === 0, '用户 B 查询未训练过的动作返回空统计，不泄漏用户 A 数据');

  } finally {
    for (const wid of createdWorkoutIds) {
      try {
        await prisma.exerciseSet.deleteMany({ where: { workoutRecordId: wid } });
        await prisma.workoutRecord.delete({ where: { id: wid } });
      } catch {}
    }
    try { await prisma.user.delete({ where: { id: userA.id } }); } catch {}
    try { await prisma.user.delete({ where: { id: userB.id } }); } catch {}
  }

  console.log('\n========================================');
  console.log(`Phase 3.5 统计与分析系统测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
