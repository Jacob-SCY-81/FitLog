import prisma from '../src/lib/prisma.js';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  loadTemplateForWorkout,
} from '../src/modules/template/template.service.js';
import { createExercise } from '../src/modules/exercise/exercise.service.js';

async function runTests() {
  console.log('=== FitLog Phase 3.2: 训练模版系统 (CRUD & Sets Planning) 全景测试 ===\n');
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

  // 1. 准备测试环境与测试用户
  const testSuffix = Date.now().toString().slice(-4);
  const userA = await prisma.user.create({
    data: { email: `tpl-user-a-${testSuffix}@fitlog.dev`, nickname: 'TplUserA' },
  });
  const userB = await prisma.user.create({
    data: { email: `tpl-user-b-${testSuffix}@fitlog.dev`, nickname: 'TplUserB' },
  });

  // 获取两个官方动作
  const officialExercises = await prisma.exercise.findMany({
    where: { isOfficial: true, deletedAt: null },
    take: 2,
  });

  // 为用户 A 创建一个私有动作
  const customExA = await createExercise(
    { name: `用户A专有动作_${testSuffix}`, targetMuscle: 'chest', equipment: '哑铃' },
    userA.id
  );

  let templateId = null;

  try {
    // -------------------------------------------------------------
    console.log('--- 1. 训练模板创建 (Create) 测试 ---');
    // -------------------------------------------------------------
    const createData = {
      name: `推胸强化模版_${testSuffix}`,
      notes: '周一专注上胸与中缝',
      exercises: [
        {
          exerciseId: officialExercises[0].id,
          sortOrder: 1,
          targetSets: 4,
          targetReps: 8,
          targetWeight: 60,
          notes: '热身2组后上大重量',
        },
        {
          exerciseId: customExA.id,
          sortOrder: 2,
          targetSets: 3,
          targetReps: 12,
          targetWeight: 20,
          notes: '顶峰收缩停顿1秒',
        },
      ],
    };

    const created = await createTemplate(createData, userA.id);
    templateId = created.id;

    assert(created.id && created.name === createData.name, '成功创建包含多个动作的训练模板');
    assert(created.userId === userA.id, '模板归属当前用户 A');
    assert(created.exercises.length === 2, '模板包含 2 个动作项');
    assert(created.exercises[0].targetSets === 4 && created.exercises[0].targetWeight === 60, '动作项预设组数与重量正确保存');
    assert(created.exercises[1].exerciseId === customExA.id, '支持加入用户私有自定义动作');

    // -------------------------------------------------------------
    console.log('\n--- 2. 训练模板检索与详情 (List & Get) 测试 ---');
    // -------------------------------------------------------------
    const list = await listTemplates(userA.id);
    assert(list.length >= 1, '成功获取用户模板列表');
    const itemInList = list.find(t => t.id === templateId);
    assert(itemInList && itemInList._count.exercises === 2, '列表项包含正确的动作统计计数');

    const detail = await getTemplate(templateId, userA.id);
    assert(detail.id === templateId, '成功获取模板详情');
    assert(detail.exercises[0].sortOrder === 1 && detail.exercises[1].sortOrder === 2, '动作严格按 sortOrder 升序排列');
    assert(detail.exercises[0].exercise.name.length > 0, '富集关联动作实体基本信息');

    // -------------------------------------------------------------
    console.log('\n--- 3. 训练模板修改 (Update) 测试 ---');
    // -------------------------------------------------------------
    const updateData = {
      name: `更新后的推胸模版_${testSuffix}`,
      notes: '更新备注：调整为金字塔法则',
      exercises: [
        // 调整顺序与动作，加入官方第2个动作
        {
          exerciseId: officialExercises[1].id,
          sortOrder: 1,
          targetSets: 5,
          targetReps: 10,
          targetWeight: 80,
          notes: '修改为首发大重量',
        },
      ],
    };

    const updated = await updateTemplate(templateId, updateData, userA.id);
    assert(updated.name === updateData.name, '模板名称成功更新');
    assert(updated.notes === updateData.notes, '模板备注成功更新');
    assert(updated.exercises.length === 1, '动作集重构成功，动作数量变更为 1');
    assert(updated.exercises[0].exerciseId === officialExercises[1].id, '动作用新加入项正确替换');
    assert(updated.exercises[0].targetSets === 5, '动作目标组数正确更新');

    // 仅更新元数据，不传递 exercises
    const metaOnlyUpdate = await updateTemplate(templateId, { name: `二次更名_${testSuffix}` }, userA.id);
    assert(metaOnlyUpdate.name === `二次更名_${testSuffix}`, '支持仅更新模板名称');
    assert(metaOnlyUpdate.exercises.length === 1, '未传 exercises 时原有动作保留无损');

    // -------------------------------------------------------------
    console.log('\n--- 4. 从模板拉起训练 (Load For Workout) 测试 ---');
    // -------------------------------------------------------------
    const workoutDraft = await loadTemplateForWorkout(templateId, userA.id);
    assert(workoutDraft.templateName === metaOnlyUpdate.name, '拉起训练包含模板名称');
    assert(Array.isArray(workoutDraft.exercises) && workoutDraft.exercises.length === 1, '拉起动作集正确');
    assert(workoutDraft.exercises[0].sets.length === 5, '根据 targetSets 自动生成 5 组训练草稿');
    assert(workoutDraft.exercises[0].sets[0].weight === 80, '预设重量 80kg 正确填充到第一组');
    assert(workoutDraft.exercises[0].sets[0].reps === 10, '预设次数 10次 正确填充到第一组');
    assert(workoutDraft.exercises[0].sets[0].isCompleted === false, '初始状态 isCompleted 为 false');

    // -------------------------------------------------------------
    console.log('\n--- 5. 权限隔离与越权拦截 (IDOR Defense) 测试 ---');
    // -------------------------------------------------------------
    let getOtherForbidden = false;
    try {
      await getTemplate(templateId, userB.id);
    } catch (err) {
      if (err.statusCode === 403) getOtherForbidden = true;
    }
    assert(getOtherForbidden, '用户 B 查看用户 A 的模板被拦截 (403 FORBIDDEN)');

    let updateOtherForbidden = false;
    try {
      await updateTemplate(templateId, { name: '黑客更名' }, userB.id);
    } catch (err) {
      if (err.statusCode === 403) updateOtherForbidden = true;
    }
    assert(updateOtherForbidden, '用户 B 修改用户 A 的模板被拦截 (403 FORBIDDEN)');

    let deleteOtherForbidden = false;
    try {
      await deleteTemplate(templateId, userB.id);
    } catch (err) {
      if (err.statusCode === 403) deleteOtherForbidden = true;
    }
    assert(deleteOtherForbidden, '用户 B 删除用户 A 的模板被拦截 (403 FORBIDDEN)');

    // -------------------------------------------------------------
    console.log('\n--- 6. 动作合法性防御 (Invalid Exercise Defense) 测试 ---');
    // -------------------------------------------------------------
    let fakeExerciseBlocked = false;
    try {
      await updateTemplate(
        templateId,
        {
          exercises: [{ exerciseId: 'non-existent-ex-id', sortOrder: 1, targetSets: 3, targetReps: 10, targetWeight: 0 }],
        },
        userA.id
      );
    } catch (err) {
      if (err.statusCode === 403 && err.errorCode === 'INVALID_EXERCISE_IDS') fakeExerciseBlocked = true;
    }
    assert(fakeExerciseBlocked, '加入不存在的动作被拒绝 (403 INVALID_EXERCISE_IDS)');

    let otherPrivateExBlocked = false;
    try {
      // 用户 B 试图使用用户 A 的私有动作建模板
      await createTemplate(
        {
          name: '非法使用他人动作模板',
          exercises: [{ exerciseId: customExA.id, sortOrder: 1, targetSets: 3, targetReps: 10, targetWeight: 0 }],
        },
        userB.id
      );
    } catch (err) {
      if (err.statusCode === 403 && err.errorCode === 'INVALID_EXERCISE_IDS') otherPrivateExBlocked = true;
    }
    assert(otherPrivateExBlocked, '用户 B 试图引入用户 A 的私有自定义动作被拦截 (403)');

    // -------------------------------------------------------------
    console.log('\n--- 7. 级联删除 (Cascade Delete) 完整性测试 ---');
    // -------------------------------------------------------------
    const deletingTemplateId = templateId;
    await deleteTemplate(deletingTemplateId, userA.id);
    templateId = null;

    const remainingExCount = await prisma.workoutTemplateExercise.count({
      where: { templateId: deletingTemplateId },
    });
    assert(remainingExCount === 0, '模板删除后，关联的 WorkoutTemplateExercise 项级联物理清理');

    let getDeletedNotFound = false;
    try {
      await getTemplate(deletingTemplateId, userA.id);
    } catch (err) {
      if (err.statusCode === 404) getDeletedNotFound = true;
    }
    assert(getDeletedNotFound, '已删除的模板无法再次读取 (404 NOT_FOUND)');

  } finally {
    // 数据清理
    if (templateId) {
      try { await prisma.workoutTemplate.delete({ where: { id: templateId } }); } catch {}
    }
    try {
      await prisma.workoutTemplateExercise.deleteMany({
        where: { exerciseId: customExA.id },
      });
      await prisma.exercise.delete({ where: { id: customExA.id } });
    } catch {}
    try { await prisma.user.delete({ where: { id: userA.id } }); } catch {}
    try { await prisma.user.delete({ where: { id: userB.id } }); } catch {}
  }

  console.log('\n========================================');
  console.log(`Phase 3.2 训练模版系统测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
