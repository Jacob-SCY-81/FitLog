import prisma from '../src/lib/prisma.js';
import {
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
  getFilterOptions,
} from '../src/modules/exercise/exercise.service.js';
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  getFavoriteIds,
} from '../src/modules/favorite/favorite.service.js';

async function runTests() {
  console.log('=== FitLog Phase 3.1: 动作库与自定义动作 CRUD 全景测试 ===\n');
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

  // 创建两个隔离的测试用户用于权限边界测试
  const userA = await prisma.user.create({
    data: { email: 'ex-test-a@fitlog.dev', nickname: 'ExerciseTesterA' },
  });
  const userB = await prisma.user.create({
    data: { email: 'ex-test-b@fitlog.dev', nickname: 'ExerciseTesterB' },
  });

  try {
    // -------------------------------------------------------------
    console.log('--- 1. 动作库检索与多维筛选测试 ---');
    // -------------------------------------------------------------
    const options = await getFilterOptions();
    assert(Array.isArray(options.muscles) && options.muscles.length > 0, '成功获取可用目标肌群过滤选项');
    assert(Array.isArray(options.equipment) && options.equipment.length > 0, '成功获取可用器械过滤选项');

    // 基础分页
    const listRes = await listExercises({ page: 1, limit: 10 }, userA.id);
    assert(listRes.data.length === 10, '动作列表第一页返回 10 个动作');
    assert(listRes.total > 100, `动作库动作总量充足 (total: ${listRes.total})`);

    // 关键词搜索
    const searchRes = await listExercises({ page: 1, limit: 10, search: '推' }, userA.id);
    assert(searchRes.data.length > 0, '关键词搜索返回匹配动作');
    assert(searchRes.data.every(e => e.name.includes('推')), '所有返回动作均包含关键词');

    // 部位过滤
    const chestMuscle = options.muscles.includes('chest') ? 'chest' : options.muscles[0];
    const muscleRes = await listExercises({ page: 1, limit: 10, muscle: chestMuscle }, userA.id);
    assert(muscleRes.data.length > 0, '部位过滤返回匹配动作');
    assert(muscleRes.data.every(e => e.targetMuscle === chestMuscle), '所有返回动作目标肌群完全匹配');

    // 官方动作详情读取 (含富文本富集)
    const officialExId = listRes.data.find(e => e.isOfficial)?.id;
    assert(officialExId !== undefined, '列表中存在官方内置标准动作');
    const officialDetail = await getExercise(officialExId, userA.id);
    assert(officialDetail.isOfficial === true, '官方动作 isOfficial 标记为 true');
    assert(Array.isArray(officialDetail.instructions), '官方动作成功富集说明要领列表');

    // -------------------------------------------------------------
    console.log('\n--- 2. 自定义动作生命周期 (CRUD) 测试 ---');
    // -------------------------------------------------------------
    // C - Create
    const customEx = await createExercise({
      name: '测试自定义复合推胸',
      targetMuscle: 'chest',
      equipment: 'dumbbell',
      notes: '单手 20kg 起，注意肘部外展 45 度',
    }, userA.id);
    assert(customEx.id !== undefined, '成功创建自定义动作');
    assert(customEx.isOfficial === false, '自定义动作 isOfficial 标记为 false');
    assert(customEx.createdById === userA.id, '自定义动作归属绑定创建者 UserA');

    // R - Read
    const customDetail = await getExercise(customEx.id, userA.id);
    assert(customDetail.name === '测试自定义复合推胸', '创建者能正常读取自定义动作详情');
    assert(customDetail.notes.includes('45 度'), '自定义备注正确读取');

    // 自定义动作出现在用户 A 的动作列表中
    const userAList = await listExercises({ page: 1, limit: 50, search: '测试自定义复合推胸' }, userA.id);
    assert(userAList.data.some(e => e.id === customEx.id), '自定义动作成功展现在创建者的动作库列表中');

    // U - Update
    const updatedEx = await updateExercise(customEx.id, {
      name: '测试自定义复合推胸 (改)',
      notes: '更新备注：调整为金字塔增重',
    }, userA.id);
    assert(updatedEx.name === '测试自定义复合推胸 (改)', '自定义动作名称成功修改');
    assert(updatedEx.notes === '更新备注：调整为金字塔增重', '自定义动作备注成功修改');

    // -------------------------------------------------------------
    console.log('\n--- 3. 权限越权与内置动作保护测试 ---');
    // -------------------------------------------------------------
    // 防御 A: 普通用户严禁修改官方内置动作
    let officialModifyBlocked = false;
    try {
      await updateExercise(officialExId, { name: '篡改官方动作名称' }, userA.id);
    } catch (err) {
      officialModifyBlocked = err.errorCode === 'CANNOT_MODIFY_OFFICIAL';
    }
    assert(officialModifyBlocked, '尝试修改官方动作被安全拦截 (CANNOT_MODIFY_OFFICIAL)');

    // 防御 B: 普通用户严禁删除官方内置动作
    let officialDeleteBlocked = false;
    try {
      await deleteExercise(officialExId, userA.id);
    } catch (err) {
      officialDeleteBlocked = err.errorCode === 'CANNOT_DELETE_OFFICIAL';
    }
    assert(officialDeleteBlocked, '尝试删除官方动作被安全拦截 (CANNOT_DELETE_OFFICIAL)');

    // 防御 C: 用户 B 严禁修改用户 A 的自定义动作
    let crossUserModifyBlocked = false;
    try {
      await updateExercise(customEx.id, { name: '黑客篡改名称' }, userB.id);
    } catch (err) {
      crossUserModifyBlocked = err.errorCode === 'FORBIDDEN';
    }
    assert(crossUserModifyBlocked, '跨用户越权修改动作被拦截 (FORBIDDEN 403)');

    // 防御 D: 用户 B 严禁查看用户 A 的私有自定义动作详情
    let crossUserViewBlocked = false;
    try {
      await getExercise(customEx.id, userB.id);
    } catch (err) {
      crossUserViewBlocked = err.errorCode === 'FORBIDDEN';
    }
    assert(crossUserViewBlocked, '跨用户查看私有动作详情被拦截 (FORBIDDEN 403)');

    // 防御 E: 用户 B 严禁删除用户 A 的自定义动作
    let crossUserDeleteBlocked = false;
    try {
      await deleteExercise(customEx.id, userB.id);
    } catch (err) {
      crossUserDeleteBlocked = err.errorCode === 'FORBIDDEN';
    }
    assert(crossUserDeleteBlocked, '跨用户越权删除动作被拦截 (FORBIDDEN 403)');

    // D - Delete (由用户 A 合法软删除)
    await deleteExercise(customEx.id, userA.id);
    let deletedReadFailed = false;
    try {
      await getExercise(customEx.id, userA.id);
    } catch (err) {
      deletedReadFailed = err.errorCode === 'NOT_FOUND';
    }
    assert(deletedReadFailed, '动作被删除后标记为 deletedAt，无法再被检索');

    // -------------------------------------------------------------
    console.log('\n--- 4. 动作收藏生命周期 (Favorite) 测试 ---');
    // -------------------------------------------------------------
    // 添加收藏
    await addFavorite(officialExId, userA.id);
    let favIds = await getFavoriteIds(userA.id);
    assert(favIds.includes(officialExId), '动作成功加入用户 A 收藏夹');

    let favList = await listFavorites(userA.id);
    assert(favList.some(e => e.id === officialExId), '收藏列表中能检索到已收藏动作');

    // 取消收藏
    await removeFavorite(officialExId, userA.id);
    favIds = await getFavoriteIds(userA.id);
    assert(!favIds.includes(officialExId), '取消收藏后动作移出收藏夹');

  } finally {
    // 数据清理
    await prisma.favoriteExercise.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.exercise.deleteMany({ where: { createdById: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  }

  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Phase 3.1 动作库与 CRUD 测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 3.1 测试运行异常:', err);
  process.exit(1);
});
