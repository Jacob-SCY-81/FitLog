import 'dotenv/config';
import http from 'http';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { getVerificationCodeStore } from '../src/lib/verification/verification-code.service.js';
import { rateLimiter } from '../src/lib/rate-limit/memory-rate-limiter.js';

let server;
let baseUrl;

async function setupServer() {
  return new Promise((resolve) => {
    // 监听随机空闲端口
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function closeServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function runTests() {
  console.log('=== FitLog Phase 2.2 手机号认证后端与安全全量测试 ===\n');

  await setupServer();
  const store = getVerificationCodeStore();

  let passed = 0;
  let failed = 0;

  const runCase = async (name, fn) => {
    try {
      await fn();
      passed++;
    } catch (err) {
      console.error(`测试用例异常 [${name}]:`, err.message);
      failed++;
    }
  };

  try {
    // ----------------------------------------------------
    console.log('--- 1. POST /api/v1/auth/phone/send-code 接口测试 ---');
    // ----------------------------------------------------
    await runCase('缺 phone 返回 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert(res.status === 400, '缺 phone 拦截返回 400');
    });

    await runCase('非法手机号格式返回 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '12345678901' }),
      });
      assert(res.status === 400, '非法号段拦截返回 400');
    });

    const testPhoneA = '13911112222';
    const normalizedPhoneA = '+8613911112222';

    await runCase('正常发送验证码', async () => {
      // 重置限流保证可发
      rateLimiter.clear();
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneA }),
      });
      const data = await res.json();
      assert(res.status === 200, '发送验证码成功返回 200');
      assert(data.code === 200, '响应 code 为 200');
      assert(data.data.cooldownSec === 60, '返回 60 秒冷却时间');
      assert(data.data.expiresInSec === 300, '返回 300 秒有效期');
      assert(data.data.code === undefined, '绝不泄露验证码明文');
      assert(data.data.codeHash === undefined, '绝不泄露验证码 Hash');
    });

    await runCase('60秒冷却期内重复发送返回 429', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneA }),
      });
      const data = await res.json();
      assert(res.status === 429, '冷却期拦截返回 429');
      assert(data.message.includes('请求过于频繁') || data.message.includes('Too many'), '错误信息提示冷却等待');
    });

    // ----------------------------------------------------
    console.log('\n--- 2. POST /api/v1/auth/phone/login 接口测试 ---');
    // ----------------------------------------------------
    await runCase('缺 code 返回 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneA }),
      });
      assert(res.status === 400, '缺 code 拦截返回 400');
    });

    await runCase('错误验证码校验失败并返回剩余次数', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneA, code: '000000' }),
      });
      const data = await res.json();
      assert(res.status === 400, '错误验证码返回 400');
      assert(data.message.includes('还可尝试') || data.message.includes('Invalid'), '提示剩余尝试次数');
    });

    await runCase('输错 5 次验证码立即失效作废', async () => {
      // 连续输错至第 5 次
      for (let i = 0; i < 4; i++) {
        await fetch(`${baseUrl}/api/v1/auth/phone/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: testPhoneA, code: '000000' }),
        });
      }
      // 检查此时验证码已从 store 清除
      const entry = await store.get(normalizedPhoneA);
      assert(entry === null, '输错 5 次后验证码已被注销');
    });

    // 重新发一条验证码测试成功登录
    rateLimiter.clear();
    await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhoneA }),
    });
    const codeEntryA = await store.get(normalizedPhoneA);
    const validCodeA = codeEntryA.code;

    let userAId = null;
    let accessTokenA = null;
    let refreshCookieA = null;

    await runCase('正确验证码首次登录成功并自动创建新用户', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneA, code: validCodeA }),
      });
      const data = await res.json();
      const setCookie = res.headers.get('set-cookie');

      assert(res.status === 200, '登录返回 200');
      assert(data.data.user.phone === normalizedPhoneA, '返回用户手机号匹配规范化号码');
      assert(data.data.user.email === null, '新手机号注册 email 为 null');
      assert(Boolean(data.data.accessToken), '成功颁发 accessToken');
      assert(setCookie && setCookie.includes('refreshToken='), '成功下发 HttpOnly refreshToken Cookie');

      userAId = data.data.user.id;
      accessTokenA = data.data.accessToken;
      refreshCookieA = setCookie.split(';')[0];
    });

    await runCase('验证码一次性使用防重放', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneA, code: validCodeA }),
      });
      assert(res.status === 400, '重复使用同一验证码被拒绝 400');
    });

    // 再次发送验证码给同一手机号测试连续性
    rateLimiter.clear();
    await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhoneA }),
    });
    const codeEntryA2 = await store.get(normalizedPhoneA);

    await runCase('账号连续性：同手机号再次登录必须沿用原 User.id', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/phone/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhoneA, code: codeEntryA2.code }),
      });
      const data = await res.json();
      assert(res.status === 200, '再次登录成功');
      assert(data.data.user.id === userAId, `User.id 保持一致 (${data.data.user.id} === ${userAId})，未创建重复用户`);
    });

    // ----------------------------------------------------
    console.log('\n--- 3. Token Refresh 与 Logout 回归测试 ---');
    // ----------------------------------------------------
    await runCase('手机号用户通过 Cookie 轮换 Refresh Token', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: refreshCookieA },
      });
      const data = await res.json();
      assert(res.status === 200, 'Refresh 成功 200');
      assert(data.data.user.phone === normalizedPhoneA, '刷新后 user.phone 正确保留');
      assert(Boolean(data.data.accessToken), '获得新的 accessToken');
    });

    await runCase('手机号用户正常登出', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessTokenA}`,
          Cookie: refreshCookieA,
        },
      });
      assert(res.status === 200, 'Logout 成功 200');
    });

    // ----------------------------------------------------
    console.log('\n--- 4. POST /api/v1/user/bind-phone 绑定测试 ---');
    // ----------------------------------------------------
    // 使用历史老用户 admin@admin
    const emailLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@admin', code: '123456' }),
    });
    const emailLoginData = await emailLoginRes.json();
    const adminUserId = emailLoginData.data.user.id;
    const adminToken = emailLoginData.data.accessToken;

    // 检查 admin@admin 绑定前的业务数据数量
    const beforeWorkouts = await prisma.workoutRecord.count({ where: { userId: adminUserId } });
    const beforeFavorites = await prisma.favoriteExercise.count({ where: { userId: adminUserId } });
    const beforeMeasurements = await prisma.bodyMeasurement.count({ where: { userId: adminUserId } });

    await runCase('未登录调用 bind-phone 返回 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/user/bind-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '13888889999', code: '123456' }),
      });
      assert(res.status === 401, '未鉴权拦截返回 401');
    });

    // 发送验证码给已占用的 testPhoneA
    rateLimiter.clear();
    await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhoneA }),
    });
    const codeEntryConflict = await store.get(normalizedPhoneA);

    await runCase('手机号已被占用时 bind-phone 返回 409', async () => {
      const res = await fetch(`${baseUrl}/api/v1/user/bind-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ phone: testPhoneA, code: codeEntryConflict.code }),
      });
      const data = await res.json();
      assert(res.status === 409, '占用冲突拦截返回 409');
      assert(data.error === 'PHONE_ALREADY_BOUND', '返回 PHONE_ALREADY_BOUND 错误码');
    });

    // 为 admin@admin 绑定一个全新手机号
    const bindPhoneB = '13988887777';
    const normalizedPhoneB = '+8613988887777';
    rateLimiter.clear();
    await fetch(`${baseUrl}/api/v1/auth/phone/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: bindPhoneB }),
    });
    const codeEntryB = await store.get(normalizedPhoneB);

    await runCase('合法绑定手机号：User.id 保持不变，历史业务数据完整无损', async () => {
      const res = await fetch(`${baseUrl}/api/v1/user/bind-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ phone: bindPhoneB, code: codeEntryB.code }),
      });
      const data = await res.json();
      assert(res.status === 200, '绑定成功返回 200');
      assert(data.data.user.id === adminUserId, 'User.id 严格保持不变');
      assert(data.data.user.email === 'admin@admin', 'email 保持不变');
      assert(data.data.user.phone === normalizedPhoneB, 'phone 成功写入');
      assert(Boolean(data.data.user.phoneVerifiedAt), 'phoneVerifiedAt 记录时间戳');

      // 验证历史数据关联未发生任何脱落
      const afterWorkouts = await prisma.workoutRecord.count({ where: { userId: adminUserId } });
      const afterFavorites = await prisma.favoriteExercise.count({ where: { userId: adminUserId } });
      const afterMeasurements = await prisma.bodyMeasurement.count({ where: { userId: adminUserId } });

      assert(afterWorkouts === beforeWorkouts, `Workout 数量一致 (${afterWorkouts} === ${beforeWorkouts})`);
      assert(afterFavorites === beforeFavorites, `Favorite 数量一致 (${afterFavorites} === ${beforeFavorites})`);
      assert(afterMeasurements === beforeMeasurements, `Measurement 数量一致 (${afterMeasurements} === ${beforeMeasurements})`);
    });

    // ----------------------------------------------------
    console.log('\n--- 5. 既有 Email 登录完全兼容性回归 ---');
    // ----------------------------------------------------
    await runCase('老用户 admin@admin 绑定手机后依然可以通过 Email 登录', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@admin', code: '123456' }),
      });
      const data = await res.json();
      assert(res.status === 200, '老用户邮箱登录正常返回 200');
      assert(data.data.user.id === adminUserId, '老用户 User.id 保持一致');
      assert(data.data.user.phone === normalizedPhoneB, '老用户返回中包含新绑定的手机号');
    });

    // ----------------------------------------------------
    // 测试善后：清理测试中新创建的用户 A，恢复 admin@admin 的 phone 为 null，保持数据库一致
    // ----------------------------------------------------
    await prisma.refreshToken.deleteMany({ where: { userId: userAId } });
    await prisma.user.delete({ where: { id: userAId } });
    await prisma.user.update({
      where: { id: adminUserId },
      data: { phone: null, phoneVerifiedAt: null },
    });
    console.log('\n[Clean Up] 测试数据已安全还原，数据库保持原始基线。');

  } finally {
    await closeServer();
    await prisma.$disconnect();
  }

  console.log(`\n========================================`);
  console.log(`Phase 2.2 测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 Phase 2.2 全部后端与安全测试用例 100% PASS！');
  }
}

runTests();
