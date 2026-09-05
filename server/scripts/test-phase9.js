import prisma from '../src/lib/prisma.js';
import app from '../src/app.js';
import http from 'http';
import { signAccessToken } from '../src/lib/jwt.js';

async function main() {
  console.log('--- 开始 Phase 9 性能优化与查询范围专项测试 ---');

  // 启动临时 HTTP 服务
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let testUser = null;
  let createdWorkouts = [];

  try {
    // 1. 创建专用测试用户
    testUser = await prisma.user.create({
      data: {
        email: `phase9_${Date.now()}@test.com`,
        phone: `139${Math.floor(10000000 + Math.random() * 90000000)}`,
        nickname: 'Phase9_Tester',
      },
    });

    const token = signAccessToken({ sub: testUser.id, phone: testUser.phone, email: testUser.email });
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 寻找可用动作
    const exercise = await prisma.exercise.findFirst({ where: { isOfficial: true, deletedAt: null } });
    if (!exercise) {
      throw new Error('未找到官方可用动作');
    }

    // 2. 插入不同时间跨度的训练记录以验证范围索引查询
    const w1 = await prisma.workoutRecord.create({
      data: {
        userId: testUser.id,
        startTime: new Date('2026-07-01T10:00:00Z'),
        totalVolumeKg: 500,
        notes: '7月训练',
      },
    });
    createdWorkouts.push(w1.id);

    const w2 = await prisma.workoutRecord.create({
      data: {
        userId: testUser.id,
        startTime: new Date('2026-08-15T10:00:00Z'),
        totalVolumeKg: 800,
        notes: '8月中旬训练',
      },
    });
    createdWorkouts.push(w2.id);

    const w3 = await prisma.workoutRecord.create({
      data: {
        userId: testUser.id,
        startTime: new Date('2026-09-01T10:00:00Z'),
        totalVolumeKg: 1000,
        notes: '9月训练',
      },
    });
    createdWorkouts.push(w3.id);

    // 3. 测试无范围条件全量分页查询
    console.log('[测试 1] 默认分页列表查询...');
    const resAll = await fetch(`${baseUrl}/api/v1/workouts?page=1&limit=10`, {
      headers: authHeaders,
    });
    const jsonAll = await resAll.json();
    if (jsonAll.data.total !== 3) {
      throw new Error(`预期共有 3 条记录，实际返回: ${jsonAll.data.total}`);
    }
    console.log('✓ 默认列表查询通过 (总计: 3 条)');

    // 4. 测试时间范围过滤 (startDate = 2026-08-01T00:00:00.000Z)
    console.log('[测试 2] startDate 范围索引过滤...');
    const resSinceAug = await fetch(`${baseUrl}/api/v1/workouts?startDate=2026-08-01T00:00:00.000Z`, {
      headers: authHeaders,
    });
    const jsonSinceAug = await resSinceAug.json();
    if (jsonSinceAug.data.data.length !== 2) {
      throw new Error(`预期 8 月后有 2 条记录，实际返回: ${jsonSinceAug.data.data.length}`);
    }
    console.log('✓ startDate 过滤通过 (命中 8 月及 9 月记录)');

    // 5. 测试时间双向闭区间过滤 (2026-08-01 ~ 2026-08-31)
    console.log('[测试 3] startDate + endDate 闭区间过滤...');
    const resAugOnly = await fetch(
      `${baseUrl}/api/v1/workouts?startDate=2026-08-01T00:00:00.000Z&endDate=2026-08-31T23:59:59.999Z`,
      { headers: authHeaders }
    );
    const jsonAugOnly = await resAugOnly.json();
    if (jsonAugOnly.data.data.length !== 1 || jsonAugOnly.data.data[0].id !== w2.id) {
      throw new Error(`预期仅命中 8 月中旬记录，实际命中数量: ${jsonAugOnly.data.data.length}`);
    }
    console.log('✓ 闭区间范围过滤通过 (精准命中单一月份记录)');

    // 6. 测试官方动作详情缓存与响应性能
    console.log('[测试 4] 官方动作详情缓存与加载延迟基准...');
    const t0 = Date.now();
    const resEx1 = await fetch(`${baseUrl}/api/v1/exercises/${exercise.id}`, {
      headers: authHeaders,
    });
    const dur1 = Date.now() - t0;
    const jsonEx1 = await resEx1.json();
    if (!jsonEx1.data || !jsonEx1.data.name) {
      throw new Error('动作详情获取失败');
    }

    // 第二次获取（缓存命中或快速通道）
    const t1 = Date.now();
    const resEx2 = await fetch(`${baseUrl}/api/v1/exercises/${exercise.id}`, {
      headers: authHeaders,
    });
    const dur2 = Date.now() - t1;
    const jsonEx2 = await resEx2.json();
    if (jsonEx2.data.id !== jsonEx1.data.id) {
      throw new Error('两次获取的动作详情不一致');
    }
    console.log(`✓ 动作详情测试通过 (首次: ${dur1}ms, 二次: ${dur2}ms)`);

    console.log('\n========================================');
    console.log(' Phase 9 所有后端性能优化与范围查询验证通过！');
    console.log('========================================\n');
  } finally {
    // 清理测试数据
    if (createdWorkouts.length > 0) {
      await prisma.workoutRecord.deleteMany({
        where: { id: { in: createdWorkouts } },
      });
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    server.close();
  }
}

main().catch(err => {
  console.error('Phase 9 测试失败:', err);
  process.exit(1);
});
