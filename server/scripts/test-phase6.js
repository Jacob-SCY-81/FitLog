import prisma from '../src/lib/prisma.js';
import * as templateService from '../src/modules/template/template.service.js';

async function main() {
  console.log('--- 开始 Phase 6 后端专项测试 ---');

  // 1. 寻找或创建测试用户 A 与 B
  let userA = await prisma.user.findFirst({ where: { email: 'phase6_user_a@test.com' } });
  if (!userA) {
    userA = await prisma.user.create({
      data: {
        email: 'phase6_user_a@test.com',
        phone: '13900006661',
        nickname: 'Phase6_A',
      },
    });
  }

  let userB = await prisma.user.findFirst({ where: { email: 'phase6_user_b@test.com' } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        email: 'phase6_user_b@test.com',
        phone: '13900006662',
        nickname: 'Phase6_B',
      },
    });
  }

  // 2. 准备动作
  const exercises = await prisma.exercise.findMany({
    where: { deletedAt: null },
    take: 2,
  });
  if (exercises.length < 2) {
    throw new Error('动作库中有效动作少于2个，请先种子初始化');
  }

  // 3. 用户 A 创建一个原模板
  const sourceTemplate = await templateService.createTemplate({
    name: '经典深蹲推胸计划',
    notes: '核心强度测试',
    exercises: [
      {
        exerciseId: exercises[0].id,
        sortOrder: 1,
        targetSets: 4,
        targetReps: 8,
        targetWeight: 80,
        notes: '控制离心',
      },
      {
        exerciseId: exercises[1].id,
        sortOrder: 2,
        targetSets: 3,
        targetReps: 12,
        targetWeight: 45,
        notes: '力竭顶峰收缩',
      },
    ],
  }, userA.id);

  console.log('✓ 用户 A 创建源模板成功:', sourceTemplate.id, sourceTemplate.name);

  // 4. 测试成功深拷贝
  const duplicated = await templateService.duplicateTemplate(sourceTemplate.id, userA.id);
  console.log('✓ 用户 A 成功复制模板:', duplicated.id, duplicated.name);
  if (duplicated.name !== '经典深蹲推胸计划 (副本)') {
    throw new Error(`模板名称不符合预期: ${duplicated.name}`);
  }
  if (duplicated.exercises.length !== 2) {
    throw new Error(`复制模板动作数量不一致: ${duplicated.exercises.length}`);
  }
  if (duplicated.exercises[0].targetSets !== 4 || duplicated.exercises[0].targetWeight !== 80) {
    throw new Error('复制动作属性与原模版不一致');
  }
  console.log('✓ 模版属性深拷贝验证成功');

  // 5. 越权测试：用户 B 试图复制用户 A 的模板
  let forbiddenCaught = false;
  try {
    await templateService.duplicateTemplate(sourceTemplate.id, userB.id);
  } catch (err) {
    if (err.statusCode === 403 || err.errorCode === 'FORBIDDEN') {
      forbiddenCaught = true;
      console.log('✓ 越权防护测试通过: 拦截用户 B 复制用户 A 模板 (403)');
    }
  }
  if (!forbiddenCaught) {
    throw new Error('越权防护失败：用户 B 复制了用户 A 的模板！');
  }

  // 6. 不存在 ID 测试
  let notFoundCaught = false;
  try {
    await templateService.duplicateTemplate('non-existent-id', userA.id);
  } catch (err) {
    if (err.statusCode === 404) {
      notFoundCaught = true;
      console.log('✓ 不存在模板 404 测试通过');
    }
  }
  if (!notFoundCaught) {
    throw new Error('404 检查失败');
  }

  // 7. 测试软删除动作过滤
  // 为用户 A 创建一个临时自定义动作
  const tempExercise = await prisma.exercise.create({
    data: {
      name: '临时待删动作_' + Date.now(),
      targetMuscle: 'chest',
      equipment: 'dumbbell',
      createdById: userA.id,
      isOfficial: false,
    },
  });

  const templateWithTempEx = await templateService.createTemplate({
    name: '包含待删动作模板',
    exercises: [
      {
        exerciseId: exercises[0].id,
        sortOrder: 1,
        targetSets: 3,
        targetReps: 10,
      },
      {
        exerciseId: tempExercise.id,
        sortOrder: 2,
        targetSets: 3,
        targetReps: 10,
      },
    ],
  }, userA.id);

  // 软删除该临时动作
  await prisma.exercise.update({
    where: { id: tempExercise.id },
    data: { deletedAt: new Date() },
  });

  // 复制该模板，验证已被软删除的动作是否被安全剔除
  const dupFiltered = await templateService.duplicateTemplate(templateWithTempEx.id, userA.id);
  console.log('✓ 包含软删除动作的模板已复制，动作总数:', dupFiltered.exercises.length);
  if (dupFiltered.exercises.length !== 1) {
    throw new Error(`软删除动作未被正确剔除: 预期 1 个，实际 ${dupFiltered.exercises.length}`);
  }
  if (dupFiltered.exercises[0].exerciseId !== exercises[0].id) {
    throw new Error('保留的动作 ID 不匹配');
  }
  console.log('✓ 软删除动作安全过滤验证通过！');

  // 清理测试数据
  await prisma.workoutTemplateExercise.deleteMany({
    where: {
      templateId: { in: [sourceTemplate.id, duplicated.id, templateWithTempEx.id, dupFiltered.id] },
    },
  });
  await prisma.workoutTemplate.deleteMany({
    where: {
      id: { in: [sourceTemplate.id, duplicated.id, templateWithTempEx.id, dupFiltered.id] },
    },
  });
  await prisma.exercise.delete({ where: { id: tempExercise.id } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });

  console.log('--- Phase 6 后端专项测试全部 PASS ---');
}

main()
  .catch((e) => {
    console.error('Phase 6 测试失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
