import { PrismaClient } from '@prisma/client';
import * as measurementService from '../src/modules/measurement/measurement.service.js';
import { updateMeasurementSchema, trendQuerySchema } from '../src/modules/measurement/measurement.validator.js';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== FitLog Phase 5: 身体围度与体征追踪系统全景测试 ===\n');

  let testUserA = null;
  let testUserB = null;
  let measurementA1 = null;
  let measurementA2 = null;

  try {
    // 0. 清理旧测试数据
    const oldUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'phase5_measure_test_' } },
      select: { id: true },
    });
    for (const u of oldUsers) {
      await prisma.bodyMeasurement.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }

    // 1. 创建测试用户
    testUserA = await prisma.user.create({
      data: {
        email: `phase5_measure_test_a_${Date.now()}@test.com`,
        nickname: 'Measure User A',
      },
    });

    testUserB = await prisma.user.create({
      data: {
        email: `phase5_measure_test_b_${Date.now()}@test.com`,
        nickname: 'Measure User B',
      },
    });

    // --- 1. 校验器单元测试 (Validator Schema Tests) ---
    console.log('--- 1. 校验器规则测试 ---');

    // updateMeasurementSchema 正常校验
    const validUpdate = updateMeasurementSchema.safeParse({
      weightKg: 75.5,
      bodyFatPct: 15.2,
      waistCm: 80.0,
      notes: '减脂期第 4 周',
    });
    assert(validUpdate.success, '允许合法的部分身体围度指标更新');

    // 拦截不合理数值 (如体重 600kg, 体脂率 70%)
    const invalidUpdate = updateMeasurementSchema.safeParse({
      weightKg: 600,
      bodyFatPct: 75,
    });
    assert(!invalidUpdate.success, '成功拦截超出合理生理范围的异常数据');

    // trendQuerySchema 白名单校验
    const validTrend = trendQuerySchema.safeParse({ days: 90, metric: 'bodyFat' });
    assert(validTrend.success && validTrend.data.metric === 'bodyFat', 'trendQuerySchema 准确解析合法指标');

    const invalidTrend = trendQuerySchema.safeParse({ days: 90, metric: 'invalid_metric' });
    assert(!invalidTrend.success, 'trendQuerySchema 拦截未授权的非法 metric 指标参数');

    // --- 2. 测量数据创建与查询测试 (CRUD Service Tests) ---
    console.log('\n--- 2. 身体数据创建与最新记录查询测试 ---');

    // 创建第一条记录 (7天前)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    measurementA1 = await measurementService.createMeasurement(
      {
        date: sevenDaysAgo.toISOString(),
        weightKg: 76.0,
        bodyFatPct: 16.5,
        chestCm: 102.0,
        waistCm: 82.5,
        hipCm: 98.0,
        armCm: 37.0,
        thighCm: 58.0,
        notes: '开始新周期测量',
      },
      testUserA.id
    );
    assert(measurementA1 && measurementA1.weightKg === 76.0, '成功创建第一条完整身体围度记录');

    // 创建第二条记录 (今天，最新)
    measurementA2 = await measurementService.createMeasurement(
      {
        date: new Date().toISOString(),
        weightKg: 74.8,
        bodyFatPct: 15.8,
        chestCm: 102.5,
        waistCm: 81.0,
        hipCm: 97.5,
        armCm: 37.5,
        thighCm: 57.5,
        notes: '体重与腰围双下降',
      },
      testUserA.id
    );
    assert(measurementA2 && measurementA2.weightKg === 74.8, '成功创建最新一条身体记录');

    // 查询分页列表
    const listResult = await measurementService.listMeasurements({ page: 1, limit: 10 }, testUserA.id);
    assert(listResult.total === 2, '用户 A 历史记录总数为 2');
    assert(listResult.data[0].id === measurementA2.id, '历史列表按时间倒序排列，最新记录排在首位');

    // 查询最新一条数据
    const latest = await measurementService.getLatestMeasurement(testUserA.id);
    assert(latest && latest.id === measurementA2.id && latest.weightKg === 74.8, 'getLatestMeasurement 精确返回最新的身体数据');

    // --- 3. 测量数据在线修改与多维更新测试 ---
    console.log('\n--- 3. 测量数据更新与越权防护测试 ---');

    // 正常更新 measurementA2 (修正体重为 74.5，腰围为 80.5)
    const updated = await measurementService.updateMeasurement(
      measurementA2.id,
      {
        weightKg: 74.5,
        waistCm: 80.5,
        notes: '复秤微调',
      },
      testUserA.id
    );
    assert(updated.weightKg === 74.5 && updated.waistCm === 80.5, '用户 A 成功在线修改身体数据');

    // 越权防御：用户 B 试图修改用户 A 的记录
    let forbiddenCaught = false;
    try {
      await measurementService.updateMeasurement(measurementA2.id, { weightKg: 80.0 }, testUserB.id);
    } catch (err) {
      if (err.statusCode === 403) forbiddenCaught = true;
    }
    assert(forbiddenCaught, '非作者用户试图修改他人身体数据被严格拦截 (403 FORBIDDEN)');

    // 404 防御：修改不存在的记录
    let notFoundCaught = false;
    try {
      await measurementService.updateMeasurement('non-existent-id-404', { weightKg: 70.0 }, testUserA.id);
    } catch (err) {
      if (err.statusCode === 404) notFoundCaught = true;
    }
    assert(notFoundCaught, '修改不存在的记录抛出标准 404 NOT_FOUND');

    // --- 4. 多指标趋势统计测试 (Multi-metric Trend Tests) ---
    console.log('\n--- 4. 多维度趋势统计分析测试 ---');

    // 体重趋势
    const weightTrend = await measurementService.getMeasurementTrend(testUserA.id, 'weight', 30);
    assert(weightTrend.length === 2, '体重趋势返回 2 个历史数据点');
    assert(weightTrend[1].value === 74.5, '最新体重趋势点反映修改后的数值 (74.5kg)');

    // 体脂率趋势
    const bodyFatTrend = await measurementService.getMeasurementTrend(testUserA.id, 'bodyFat', 30);
    assert(bodyFatTrend.length === 2, '体脂率趋势准确提取 2 个历史点');
    assert(bodyFatTrend[0].value === 16.5 && bodyFatTrend[1].value === 15.8, '体脂率数值准确映射');

    // 腰围趋势
    const waistTrend = await measurementService.getMeasurementTrend(testUserA.id, 'waist', 30);
    assert(waistTrend.length === 2, '腰围趋势准确返回');
    assert(waistTrend[1].value === 80.5, '腰围最新点为 80.5cm');

    // --- 5. 删除与租户隔离测试 ---
    console.log('\n--- 5. 安全删除与跨租户隔离测试 ---');

    // 用户 B 列表为空
    const listB = await measurementService.listMeasurements({ page: 1, limit: 10 }, testUserB.id);
    assert(listB.total === 0, '用户 B 历史测量数据严格隔离为空');

    // 用户 B 试图删除用户 A 的记录被拦截
    let deleteForbidden = false;
    try {
      await measurementService.deleteMeasurement(measurementA1.id, testUserB.id);
    } catch (err) {
      if (err.statusCode === 403) deleteForbidden = true;
    }
    assert(deleteForbidden, '用户 B 试图删除用户 A 记录被拦截 (403 FORBIDDEN)');

    // 用户 A 正常删除记录
    await measurementService.deleteMeasurement(measurementA1.id, testUserA.id);
    const listAfterDelete = await measurementService.listMeasurements({ page: 1, limit: 10 }, testUserA.id);
    assert(listAfterDelete.total === 1, '用户 A 成功删除旧记录，总数减少为 1');

  } catch (error) {
    console.error('测试执行出现异常:', error);
    failed++;
  } finally {
    // 清理测试用户及数据
    if (testUserA) {
      await prisma.bodyMeasurement.deleteMany({ where: { userId: testUserA.id } });
      await prisma.user.deleteMany({ where: { id: testUserA.id } });
    }
    if (testUserB) {
      await prisma.bodyMeasurement.deleteMany({ where: { userId: testUserB.id } });
      await prisma.user.deleteMany({ where: { id: testUserB.id } });
    }
    await prisma.$disconnect();

    console.log('\n========================================');
    console.log(`Phase 5 身体数据与多维分析测试汇总: 通过 ${passed}, 失败 ${failed}`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
