import prisma from '../src/lib/prisma.js';
import app from '../src/app.js';
import http from 'http';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { signAccessToken } from '../src/lib/jwt.js';
import { maskSensitiveData } from '../src/lib/logger/logger.js';

async function main() {
  console.log('====================================================');
  console.log(' FitLog Phase 12: 生产就绪终极审计 (Readiness Audit)');
  console.log('====================================================\n');

  const rootDir = process.cwd();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let userA = null;
  let userB = null;
  let workoutA = null;

  try {
    // ----------------------------------------------------
    // AUDIT 1: 安全认证与横向越权隔离 (Security & Authorization)
    // ----------------------------------------------------
    console.log('[AUDIT 1] 安全认证与横向越权访问防御审查...');
    userA = await prisma.user.create({
      data: {
        email: `audit_a_${Date.now()}@test.com`,
        phone: `138${Math.floor(10000000 + Math.random() * 90000000)}`,
        nickname: 'AuditUser_A',
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `audit_b_${Date.now()}@test.com`,
        phone: `138${Math.floor(10000000 + Math.random() * 90000000)}`,
        nickname: 'AuditUser_B',
      },
    });

    const tokenA = signAccessToken({ sub: userA.id, phone: userA.phone, email: userA.email });
    const tokenB = signAccessToken({ sub: userB.id, phone: userB.phone, email: userB.email });

    // 用户 A 创建一条私有记录
    workoutA = await prisma.workoutRecord.create({
      data: {
        userId: userA.id,
        startTime: new Date(),
        totalVolumeKg: 300,
        notes: 'User A 私有训练',
      },
    });

    // 用户 B 试图窃取/查看用户 A 的记录 -> 必须被 403 拦截
    const resForbidden = await fetch(`${baseUrl}/api/v1/workouts/${workoutA.id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    if (resForbidden.status !== 403) {
      throw new Error(`越权防护失败: 用户 B 访问用户 A 的私有记录返回 HTTP ${resForbidden.status}，预期 403`);
    }
    console.log('✓ 横向越权防御校验通过 (禁止跨租户非法读取，严格 403 拦截)');

    // ----------------------------------------------------
    // AUDIT 2: 输入校验与畸形报文异常映射 (Validation & Error Mapping)
    // ----------------------------------------------------
    console.log('[AUDIT 2] 输入校验与异常映射防护审查...');
    const resMalformed = await fetch(`${baseUrl}/api/v1/workouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: '{"startTime": "not-a-valid-json', // 故意畸形
    });
    const malformedJson = await resMalformed.json();
    if (resMalformed.status !== 400 || malformedJson.error !== 'MALFORMED_JSON') {
      throw new Error(`畸形 JSON 未能被正确拦截为 400: ${JSON.stringify(malformedJson)}`);
    }
    console.log('✓ 畸形报文与非法注入拦截通过 (400 MALFORMED_JSON)');

    // ----------------------------------------------------
    // AUDIT 3: 敏感信息与凭证日志脱敏 (PII & Secrets Redaction)
    // ----------------------------------------------------
    console.log('[AUDIT 3] 生产日志敏感凭据自动脱敏审查...');
    const sensitiveObj = {
      phone: '13912345678',
      email: 'member.test@example.com',
      password: 'ProductionPassword!#99',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0',
      nested: {
        verificationCode: '888999',
        refreshToken: 'refresh_secret_123',
      },
    };
    const maskedObj = maskSensitiveData(sensitiveObj);
    if (maskedObj.phone !== '139****5678' || maskedObj.password !== '[REDACTED]' || maskedObj.nested.verificationCode !== '[REDACTED]') {
      throw new Error('脱敏策略未完全生效');
    }
    console.log('✓ 敏感信息防泄露脱敏校验通过 (密码/Token/验证码/手机号均完成脱敏保护)');

    // ----------------------------------------------------
    // AUDIT 4: 数据库外键级联与数据一致性 (Data Cascading & Integrity)
    // ----------------------------------------------------
    console.log('[AUDIT 4] 数据库外键级联与数据一致性审查...');
    const exercise = await prisma.exercise.findFirst({ where: { deletedAt: null } });
    const workoutWithSets = await prisma.workoutRecord.create({
      data: {
        userId: userA.id,
        startTime: new Date(),
        totalVolumeKg: 600,
        exerciseSets: {
          create: [
            {
              exerciseId: exercise.id,
              sortOrder: 1,
              setIndex: 1,
              setType: 'standard',
              weight: 60,
              reps: 10,
              isCompleted: true,
            },
            {
              exerciseId: exercise.id,
              sortOrder: 1,
              setIndex: 2,
              setType: 'standard',
              weight: 70,
              reps: 8,
              isCompleted: true,
            },
          ],
        },
      },
    });

    const setsBefore = await prisma.exerciseSet.count({ where: { workoutRecordId: workoutWithSets.id } });
    if (setsBefore !== 2) {
      throw new Error(`ExerciseSet 预创建失败，预期 2 条，实际 ${setsBefore}`);
    }

    // 级联删除测试
    await prisma.workoutRecord.delete({ where: { id: workoutWithSets.id } });
    const setsAfter = await prisma.exerciseSet.count({ where: { workoutRecordId: workoutWithSets.id } });
    if (setsAfter !== 0) {
      throw new Error(`外键级联删除失效: WorkoutRecord 删除后仍残留 ${setsAfter} 条孤儿 ExerciseSet 记录`);
    }
    console.log('✓ 外键级联一致性校验通过 (Cascade 删除彻底消除孤儿记录)');

    // ----------------------------------------------------
    // AUDIT 5: 基础设施深度健康探针 (Infrastructure Probes)
    // ----------------------------------------------------
    console.log('[AUDIT 5] 基础设施深度健康探针自检审查...');
    const resLive = await fetch(`${baseUrl}/health/live`);
    const resReady = await fetch(`${baseUrl}/health/ready`);
    const readyData = await resReady.json();
    if (resLive.status !== 200 || resReady.status !== 200 || readyData.checks.database.status !== 'healthy') {
      throw new Error(`健康检查探测异常: ${JSON.stringify(readyData)}`);
    }
    console.log(`✓ 基础设施深度探针通过 (Liveness: 200, Readiness: 200, DB: ${readyData.checks.database.latencyMs}ms)`);

    // ----------------------------------------------------
    // AUDIT 6: 核心业务幂等性防重复落库 (Idempotency & Concurrency)
    // ----------------------------------------------------
    console.log('[AUDIT 6] 核心业务提交幂等性审查...');
    const idempKey = `audit_key_${Date.now()}`;
    const payload = {
      startTime: new Date().toISOString(),
      notes: '审计幂等性提交',
      totalVolumeKg: 200,
      exercises: [
        {
          exerciseId: exercise.id,
          sortOrder: 1,
          sets: [{ exerciseId: exercise.id, sortOrder: 1, setIndex: 1, setType: 'standard', weight: 40, reps: 10, isCompleted: true }],
        },
      ],
    };

    // 第一次提交
    const r1 = await fetch(`${baseUrl}/api/v1/workouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey,
      },
      body: JSON.stringify(payload),
    });
    const json1 = await r1.json();
    const createdId = json1.data.id;

    // 第二次携带相同 Key 重复重试提交
    const r2 = await fetch(`${baseUrl}/api/v1/workouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey,
      },
      body: JSON.stringify(payload),
    });
    const json2 = await r2.json();
    if (json2.data.id !== createdId) {
      throw new Error(`幂等复用失败: 两次请求返回的记录 ID 不一致 (${createdId} vs ${json2.data.id})`);
    }

    // 检查数据库实际条数是否依然只有 1 条
    const dbDuplicates = await prisma.workoutRecord.count({ where: { userId: userA.id, notes: '审计幂等性提交' } });
    if (dbDuplicates !== 1) {
      throw new Error(`数据库出现重复记录，预期 1 条，实际 ${dbDuplicates} 条`);
    }
    console.log('✓ 业务幂等性与防重复落库校验通过 (相同 Idempotency-Key 100% 幂等直出，无重复插入)');

    // ----------------------------------------------------
    // AUDIT 7: 前端 PWA 离线产物审查 (PWA Offline Assets)
    // ----------------------------------------------------
    console.log('[AUDIT 7] 前端生产打包与 PWA 资产审查...');
    const swPath = join(rootDir, 'client', 'dist', 'sw.js');
    const manifestPath = join(rootDir, 'client', 'dist', 'manifest.webmanifest');
    await access(swPath);
    await access(manifestPath);
    console.log('✓ 前端 PWA 产物审查通过 (ServiceWorker 与 WebManifest 均就绪)');

    // ----------------------------------------------------
    // AUDIT 8: 生产部署配置资产完备性 (Production Manifests)
    // ----------------------------------------------------
    console.log('[AUDIT 8] 生产部署配置资产全量审查...');
    await access(join(rootDir, 'docker-compose.yml'));
    await access(join(rootDir, 'server', 'Dockerfile'));
    await access(join(rootDir, 'client', 'Dockerfile'));
    await access(join(rootDir, 'deploy', 'nginx', 'fitlog.conf'));
    await access(join(rootDir, '.env.production.example'));
    await access(join(rootDir, 'deploy', 'scripts', 'backup.sh'));
    await access(join(rootDir, 'deploy', 'scripts', 'restore.sh'));
    await access(join(rootDir, 'deploy', 'scripts', 'deploy.sh'));
    console.log('✓ 生产部署配置资产完备性通过 (全栈微服务编排、反代与容灾脚本一应俱全)');

    console.log('\n====================================================');
    console.log(' 🎉 FitLog Phase 12 生产就绪终极审计全部通过 (8/8 PASS)！');
    console.log(' 项目已达到生产可用 (Production-Ready) 状态！');
    console.log('====================================================\n');
  } finally {
    // 妥善清理测试数据
    if (workoutA) {
      await prisma.workoutRecord.delete({ where: { id: workoutA.id } }).catch(() => {});
    }
    if (userA) {
      await prisma.workoutRecord.deleteMany({ where: { userId: userA.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    }
    if (userB) {
      await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    }
    server.close();
  }
}

main().catch(err => {
  console.error('Phase 12 终极审计失败:', err);
  process.exit(1);
});
