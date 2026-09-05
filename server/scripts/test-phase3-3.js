import prisma from '../src/lib/prisma.js';
import {
  createWorkout,
  listWorkouts,
  getWorkout,
  updateWorkout,
  deleteWorkout,
} from '../src/modules/workout/workout.service.js';
import { createExercise } from '../src/modules/exercise/exercise.service.js';

async function runTests() {
  console.log('=== FitLog Phase 3.3: 训练记录核心交互与组数管理全景测试 ===\n');
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

  // 准备测试环境
  const testSuffix = Date.now().toString().slice(-4);
  const userA = await prisma.user.create({
    data: { email: `rec-user-a-${testSuffix}@fitlog.dev`, nickname: 'RecUserA' },
  });
  const userB = await prisma.user.create({
    data: { email: `rec-user-b-${testSuffix}@fitlog.dev`, nickname: 'RecUserB' },
  });

  // 获取官方动作
  const officialExercises = await prisma.exercise.findMany({
    where: { isOfficial: true, deletedAt: null },
    take: 2,
  });

  // 创建用户 A 私有动作
  const customExA = await createExercise(
    { name: `记录器动作_${testSuffix}`, targetMuscle: 'chest', equipment: '哑铃' },
    userA.id
  );

  let workoutId = null;

  try {
    // -------------------------------------------------------------
    console.log('--- 1. 训练记录创建与动态组 (Sets & RPE) 测试 ---');
    // -------------------------------------------------------------
    const now = new Date();
    const startTime = new Date(now.getTime() - 3600 * 1000).toISOString();
    const set1CompletedAt = new Date(now.getTime() - 1800 * 1000).toISOString();
    const set2CompletedAt = new Date(now.getTime() - 1710 * 1000).toISOString();

    const workoutPayload = {
      startTime,
      endTime: now.toISOString(),
      notes: '今天卧推状态极佳，突破个人容量纪录',
      totalVolumeKg: 3450.5,
      exercises: [
        {
          exerciseId: officialExercises[0].id,
          sortOrder: 1,
          sets: [
            {
              setIndex: 1,
              setType: 'warmup',
              weight: 40.0,
              reps: 15,
              rpe: 6.0,
              completedAt: set1CompletedAt,
              actualRestTimeSec: 0,
              isCompleted: true,
            },
            {
              setIndex: 2,
              setType: 'standard',
              weight: 80.0,
              reps: 10,
              rpe: 8.5,
              completedAt: set2CompletedAt,
              actualRestTimeSec: 90,
              isCompleted: true,
            },
            {
              setIndex: 3,
              setType: 'dropset',
              weight: 60.0,
              reps: 12,
              rpe: 9.5,
              completedAt: null,
              actualRestTimeSec: 60,
              isCompleted: false,
            },
          ],
        },
        {
          exerciseId: customExA.id,
          sortOrder: 2,
          sets: [
            {
              setIndex: 1,
              setType: 'failure',
              weight: 22.5,
              reps: 8,
              rpe: 10.0,
              completedAt: now.toISOString(),
              actualRestTimeSec: 120,
              isCompleted: true,
            },
          ],
        },
      ],
    };

    const created = await createWorkout(workoutPayload, userA.id);
    workoutId = created.id;

    assert(created.id && created.userId === userA.id, '成功创建训练记录，关联归属用户 A');
    assert(created.totalVolumeKg === 3450.5, '训练总容量 totalVolumeKg 精确保存');
    assert(created.exerciseSets.length === 4, '完整保存 2 个动作共 4 组训练详情');
    assert(created.exerciseSets[0].setType === 'warmup', '第一组成功保存为热身组 (warmup)');
    assert(created.exerciseSets[1].rpe === 8.5, '第二组支持浮点数 RPE 8.5');
    assert(created.exerciseSets[1].actualRestTimeSec === 90, '第二组保存实际组间休息 90s');
    assert(created.exerciseSets[2].isCompleted === false, '第三组未完成状态正确保存');
    assert(created.exerciseSets[3].setType === 'failure', '第四组保存为力竭组 (failure)');

    // -------------------------------------------------------------
    console.log('\n--- 2. 训练记录分页检索与排序 (List Workouts) 测试 ---');
    // -------------------------------------------------------------
    const list = await listWorkouts({ page: 1, limit: 10 }, userA.id);
    assert(list.data.length >= 1, '成功分页查询当前用户训练历史');
    const targetInList = list.data.find(w => w.id === workoutId);
    assert(targetInList && targetInList._count.exerciseSets === 4, '列表项统计动作组数正确 (_count: 4)');
    assert(list.data[0].startTime >= list.data[list.data.length - 1].startTime, '训练历史严格按开始时间降序排列');

    // -------------------------------------------------------------
    console.log('\n--- 3. 训练记录详情获取 (Get Workout Detail) 测试 ---');
    // -------------------------------------------------------------
    const detail = await getWorkout(workoutId, userA.id);
    assert(detail.id === workoutId, '成功获取训练记录详情');
    assert(detail.notes === workoutPayload.notes, '正确读取训练备注');
    assert(detail.exerciseSets[0].exercise.name.length > 0, '富集关联动作实体名称');
    assert(
      detail.exerciseSets[0].sortOrder === 1 &&
      detail.exerciseSets[1].sortOrder === 1 &&
      detail.exerciseSets[2].sortOrder === 1 &&
      detail.exerciseSets[3].sortOrder === 2,
      '所有组按动作 sortOrder 严格升序排列'
    );
    assert(
      detail.exerciseSets[0].setIndex === 1 &&
      detail.exerciseSets[1].setIndex === 2 &&
      detail.exerciseSets[2].setIndex === 3,
      '同一动作内按 setIndex 严格升序排列'
    );

    // -------------------------------------------------------------
    console.log('\n--- 4. 训练记录更新与防篡改 (Update Workout) 测试 ---');
    // -------------------------------------------------------------
    const updatedEndTime = new Date(now.getTime() + 600 * 1000).toISOString();
    const updated = await updateWorkout(workoutId, { notes: '更新后的备注说明', endTime: updatedEndTime }, userA.id);
    assert(updated.notes === '更新后的备注说明', '成功更新训练备注');
    assert(new Date(updated.endTime).toISOString() === updatedEndTime, '成功更新训练结束时间');
    assert(updated.exerciseSets.length === 4, '更新训练元数据时，组数与历史训练数据保持防篡改无损');

    // -------------------------------------------------------------
    console.log('\n--- 5. 权限隔离与越权拦截 (IDOR Defense) 测试 ---');
    // -------------------------------------------------------------
    let getOtherForbidden = false;
    try {
      await getWorkout(workoutId, userB.id);
    } catch (err) {
      if (err.statusCode === 403) getOtherForbidden = true;
    }
    assert(getOtherForbidden, '用户 B 查看用户 A 的训练记录被拦截 (403 FORBIDDEN)');

    let updateOtherForbidden = false;
    try {
      await updateWorkout(workoutId, { notes: '黑客篡改' }, userB.id);
    } catch (err) {
      if (err.statusCode === 403) updateOtherForbidden = true;
    }
    assert(updateOtherForbidden, '用户 B 修改用户 A 的训练记录被拦截 (403 FORBIDDEN)');

    let deleteOtherForbidden = false;
    try {
      await deleteWorkout(workoutId, userB.id);
    } catch (err) {
      if (err.statusCode === 403) deleteOtherForbidden = true;
    }
    assert(deleteOtherForbidden, '用户 B 删除用户 A 的训练记录被拦截 (403 FORBIDDEN)');

    // -------------------------------------------------------------
    console.log('\n--- 6. 动作合法性防御 (Invalid Exercise Defense) 测试 ---');
    // -------------------------------------------------------------
    let fakeExerciseBlocked = false;
    try {
      await createWorkout(
        {
          startTime: new Date().toISOString(),
          totalVolumeKg: 100,
          exercises: [
            {
              exerciseId: 'non-existent-exercise-id',
              sortOrder: 1,
              sets: [{ setIndex: 1, setType: 'standard', weight: 50, reps: 10, actualRestTimeSec: 0, isCompleted: true }],
            },
          ],
        },
        userA.id
      );
    } catch (err) {
      if (err.statusCode === 403 && err.errorCode === 'INVALID_EXERCISE_IDS') fakeExerciseBlocked = true;
    }
    assert(fakeExerciseBlocked, '引入不存在的动作记录被拒绝 (403 INVALID_EXERCISE_IDS)');

    let otherPrivateExBlocked = false;
    try {
      await createWorkout(
        {
          startTime: new Date().toISOString(),
          totalVolumeKg: 100,
          exercises: [
            {
              exerciseId: customExA.id,
              sortOrder: 1,
              sets: [{ setIndex: 1, setType: 'standard', weight: 50, reps: 10, actualRestTimeSec: 0, isCompleted: true }],
            },
          ],
        },
        userB.id
      );
    } catch (err) {
      if (err.statusCode === 403 && err.errorCode === 'INVALID_EXERCISE_IDS') otherPrivateExBlocked = true;
    }
    assert(otherPrivateExBlocked, '用户 B 试图使用用户 A 的私有动作提交训练被拦截 (403)');

    // -------------------------------------------------------------
    console.log('\n--- 7. 级联删除 (Cascade Delete) 完整性测试 ---');
    // -------------------------------------------------------------
    const deletingWorkoutId = workoutId;
    await deleteWorkout(deletingWorkoutId, userA.id);
    workoutId = null;

    const remainingSetsCount = await prisma.exerciseSet.count({
      where: { workoutRecordId: deletingWorkoutId },
    });
    assert(remainingSetsCount === 0, '删除训练记录后，所有关联的 ExerciseSet 组数据级联物理清理');

    let getDeletedNotFound = false;
    try {
      await getWorkout(deletingWorkoutId, userA.id);
    } catch (err) {
      if (err.statusCode === 404) getDeletedNotFound = true;
    }
    assert(getDeletedNotFound, '已删除的训练记录无法再次读取 (404 NOT_FOUND)');

  } finally {
    if (workoutId) {
      try { await prisma.workoutRecord.delete({ where: { id: workoutId } }); } catch {}
    }
    try {
      await prisma.exercise.delete({ where: { id: customExA.id } });
    } catch {}
    try { await prisma.user.delete({ where: { id: userA.id } }); } catch {}
    try { await prisma.user.delete({ where: { id: userB.id } }); } catch {}
  }

  console.log('\n========================================');
  console.log(`Phase 3.3 训练记录系统测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
