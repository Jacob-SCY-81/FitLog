import prisma from '../src/lib/prisma.js';
import app from '../src/app.js';
import http from 'http';
import { signAccessToken } from '../src/lib/jwt.js';

async function main() {
  console.log('--- 开始 Phase 8 可靠性与幂等性专项测试 ---');

  // 启动临时 HTTP 服务
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 1. 寻找或创建测试用户
  let user = await prisma.user.findFirst({ where: { email: 'phase8_user@test.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'phase8_user@test.com',
        phone: '13900008881',
        nickname: 'Phase8_Tester',
      },
    });
  }

  const token = signAccessToken({ sub: user.id, phone: user.phone, email: user.email });

  // 准备动作
  const exercise = await prisma.exercise.findFirst({ where: { deletedAt: null } });
  if (!exercise) {
    throw new Error('动作库中没有可用动作');
  }

  // 2. 测试 Idempotency-Key 防重复创建
  const idempotencyKey = `test_key_${Date.now()}`;
  const payload = {
    startTime: new Date().toISOString(),
    notes: 'Phase8 幂等性测试记录',
    totalVolumeKg: 100,
    exercises: [
      {
        exerciseId: exercise.id,
        sortOrder: 1,
        sets: [
          {
            exerciseId: exercise.id,
            sortOrder: 1,
            setIndex: 1,
            setType: 'standard',
            weight: 50,
            reps: 10,
            isCompleted: true,
          },
        ],
      },
    ],
  };

  const initialCount = await prisma.workoutRecord.count({ where: { userId: user.id } });

  // 第一次请求
  const res1 = await fetch(`${baseUrl}/api/v1/workouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const body1 = await res1.json();
  if (res1.status !== 200 && res1.status !== 201) {
    throw new Error(`首次提交失败: status ${res1.status}, body: ${JSON.stringify(body1)}`);
  }
  const createdWorkoutId = body1.data.id;
  console.log('✓ 首次幂等提交成功，生成记录 ID:', createdWorkoutId);

  // 第二次使用相同的 Idempotency-Key 提交（模拟弱网客户端重试）
  const res2 = await fetch(`${baseUrl}/api/v1/workouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const body2 = await res2.json();
  if (res2.status !== 200 && res2.status !== 201) {
    throw new Error(`二次幂等提交返回异常: status ${res2.status}`);
  }
  if (res2.headers.get('x-cache-lookup') !== 'HIT-IDEMPOTENT') {
    throw new Error('二次提交未命中幂等缓存 (缺少 X-Cache-Lookup: HIT-IDEMPOTENT)');
  }
  if (body2.data.id !== createdWorkoutId) {
    throw new Error('二次提交返回的记录 ID 与首次不一致！');
  }
  console.log('✓ 二次幂等提交正确命中幂等缓存，直出一致响应');

  // 检查数据库中实际记录数
  const finalCount = await prisma.workoutRecord.count({ where: { userId: user.id } });
  if (finalCount !== initialCount + 1) {
    throw new Error(`幂等防御失败：预期增加 1 条记录，实际增加了 ${finalCount - initialCount} 条！`);
  }
  console.log('✓ 数据库落库校验通过：强一致无重复记录');

  // 3. 测试错误处理中间件的异常映射兜底
  // 测试发送损坏的畸形 JSON 字符串
  const malformedRes = await fetch(`${baseUrl}/api/v1/workouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: '{"bad_json: 123',
  });

  const malformedBody = await malformedRes.json();
  if (malformedRes.status !== 400 || malformedBody.error !== 'MALFORMED_JSON') {
    throw new Error(`畸形报文未正确映射为 MALFORMED_JSON: status ${malformedRes.status}`);
  }
  console.log('✓ 畸形报文防护通过：返回 400 MALFORMED_JSON');

  // 清理临时 server
  await new Promise(resolve => server.close(resolve));

  // 清理测试生成的训练数据
  await prisma.exerciseSet.deleteMany({ where: { workoutRecordId: createdWorkoutId } });
  await prisma.workoutRecord.delete({ where: { id: createdWorkoutId } });

  console.log('--- Phase 8 可靠性与幂等性专项测试全部 PASS ---');
}

main()
  .catch((e) => {
    console.error('Phase 8 测试失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
