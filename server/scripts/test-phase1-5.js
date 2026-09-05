import http from 'http';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data,
            cookies: res.headers['set-cookie'] || [],
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function extractCookie(cookieHeaders, name) {
  for (const c of cookieHeaders) {
    const match = c.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function runTests() {
  console.log('=== FitLog Phase 1.5 核心自动化回归测试 ===\n');
  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${extra}`);
      failed++;
    }
  }

  // 1. 启动测试服务器
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`测试服务器已启动: ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // --- Test 1: User A 登录 ---
    const loginA = await request('POST', '/api/v1/auth/login', {
      email: 'admin@admin',
      code: '123456',
    });
    assert('User A 正常登录', loginA.status === 200 && loginA.data?.data?.accessToken);
    const tokenA = loginA.data.data.accessToken;
    const userA = loginA.data.data.user;
    const refreshCookieA = extractCookie(loginA.cookies, 'refreshToken');
    assert('User A 获得 HttpOnly RefreshToken Cookie', !!refreshCookieA);

    // --- Test 2: P0-2 Refresh 接口返回 user 实体 ---
    const refreshRes = await request(
      'POST',
      '/api/v1/auth/refresh',
      {},
      { Cookie: `refreshToken=${refreshCookieA}` }
    );
    assert('POST /auth/refresh 成功响应 200', refreshRes.status === 200);
    assert('Refresh 返回新 accessToken', !!refreshRes.data?.data?.accessToken);
    assert('Refresh 返回有效 user 实体 (P0-2)', !!refreshRes.data?.data?.user?.id && refreshRes.data?.data?.user?.email === 'admin@admin');
    const newRefreshCookie = extractCookie(refreshRes.cookies, 'refreshToken');
    assert('Refresh Token 成功轮换 (Rotation)', !!newRefreshCookie && newRefreshCookie !== refreshCookieA);

    // --- Test 3: 无 Cookie 或无效 Cookie 请求 refresh 返回 401 ---
    const badRefresh = await request('POST', '/api/v1/auth/refresh', {});
    assert('无 Cookie 请求 refresh 返回 401', badRefresh.status === 401);

    // --- Test 4: User B 登录 (隔离测试) ---
    // 先获取验证码
    await request('POST', '/api/v1/auth/send-code', { email: 'userb@fitlog.dev' });
    // User B 登录
    let userBRecord = await prisma.user.findUnique({ where: { email: 'userb@fitlog.dev' } });
    if (!userBRecord) {
      userBRecord = await prisma.user.create({ data: { email: 'userb@fitlog.dev', nickname: 'User B' } });
    }
    // 直接生成 User B 的 Token
    const { signAccessToken } = await import('../src/lib/jwt.js');
    const tokenB = signAccessToken({ sub: userBRecord.id, email: userBRecord.email });
    assert('User B Token 生成成功', !!tokenB);

    // --- Test 5: 创建 User A 的私有资源 ---
    // 创建 User A 的训练模板
    const tplA = await request(
      'POST',
      '/api/v1/templates',
      {
        name: 'User A 专属私有模板',
        notes: '绝密计划',
        exercises: [{ exerciseId: '0001', sortOrder: 1, targetSets: 3, targetReps: 10, targetWeight: 50 }],
      },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('User A 创建训练模板', tplA.status === 201 && tplA.data?.data?.id);
    const tplAId = tplA.data.data.id;

    // 创建 User A 的身体数据
    const measA = await request(
      'POST',
      '/api/v1/measurements',
      { weightKg: 75.5, bodyFatPct: 15.0, notes: 'User A 私密围度' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('User A 创建身体数据', measA.status === 201 && measA.data?.data?.id);
    const measAId = measA.data.data.id;

    // --- Test 6: User B 越权访问 User A 资源拦截校验 (Security Isolation) ---
    // User B 读取 User A 的模板 -> 应该 403 或 404
    const bReadTpl = await request('GET', `/api/v1/templates/${tplAId}`, null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert('越权拦截: User B 无法读取 User A 的模板 (403/404)', bReadTpl.status === 403 || bReadTpl.status === 404);

    // User B 删除 User A 的身体数据 -> 应该 403 或 404
    const bDelMeas = await request('DELETE', `/api/v1/measurements/${measAId}`, null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert('越权拦截: User B 无法删除 User A 的身体数据 (403/404)', bDelMeas.status === 403 || bDelMeas.status === 404);

    // --- Test 7: 清理测试模板与身体数据 ---
    await request('DELETE', `/api/v1/templates/${tplAId}`, null, { Authorization: `Bearer ${tokenA}` });
    await request('DELETE', `/api/v1/measurements/${measAId}`, null, { Authorization: `Bearer ${tokenA}` });

    // --- Test 8: Logout 验证 ---
    const logoutRes = await request(
      'POST',
      '/api/v1/auth/logout',
      {},
      {
        Authorization: `Bearer ${tokenA}`,
        Cookie: `refreshToken=${newRefreshCookie}`,
      }
    );
    assert('Logout 接口返回 200', logoutRes.status === 200);

    // 用已退出的 Refresh Token 尝试 refresh 应该返回 401
    const revokedRefresh = await request(
      'POST',
      '/api/v1/auth/refresh',
      {},
      { Cookie: `refreshToken=${newRefreshCookie}` }
    );
    assert('已登出的 Refresh Token 无法再次换票 (401)', revokedRefresh.status === 401);

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log(`\n测试统计: 通过 ${passed}, 失败 ${failed}`);
  if (failed > 0) {
    throw new Error(`存在 ${failed} 项测试失败！`);
  }
}

runTests()
  .then(() => {
    console.log('✅ Phase 1.5 核心自动化测试全部通过！');
  })
  .catch((err) => {
    console.error('测试异常:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
