import http from 'http';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import {
  normalizePhone,
  isValidMainlandMobile,
  tryNormalizePhone,
} from '../src/lib/phone/normalize.js';
import {
  generateVerificationCode,
  storeVerificationCode,
  consumeVerificationCode,
  setVerificationCodeStore,
} from '../src/lib/verification/verification-code.service.js';
import { MemoryVerificationCodeStore } from '../src/lib/verification/verification-code.store.js';
import { MemoryRateLimiter } from '../src/lib/rate-limit/memory-rate-limiter.js';
import { DevConsoleSmsProvider } from '../src/lib/sms/dev-console-sms.provider.js';
import { MockSmsProvider } from '../src/lib/sms/mock-sms.provider.js';

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

async function runAllTests() {
  console.log('=== FitLog Phase 2.1 基础设施全量测试 ===\n');
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

  // ==========================================
  // 1. Phone Normalization Tests
  // ==========================================
  console.log('--- 1. 手机号规范化与校验测试 ---');

  assert('标准 11 位输入规范化为 +86', normalizePhone('13800138000') === '+8613800138000');
  assert('+86 开头输入保留规范化', normalizePhone('+8613800138000') === '+8613800138000');
  assert('0086 国际冠字前缀正确剥离', normalizePhone('008613800138000') === '+8613800138000');
  assert('带空格格式正确清洗', normalizePhone(' 138 0013 8000 ') === '+8613800138000');
  assert('带短横线格式正确清洗', normalizePhone('138-0013-8000') === '+8613800138000');

  // 非法测试
  assert('非法长度(10位)校验失败', isValidMainlandMobile('1380013800') === false);
  assert('非法长度(12位)校验失败', isValidMainlandMobile('138001380000') === false);
  assert('非法号段前缀(12开头)校验失败', isValidMainlandMobile('12800138000') === false);
  assert('空字符串校验失败', isValidMainlandMobile('') === false);
  assert('null 校验失败', isValidMainlandMobile(null) === false);
  assert('undefined 校验失败', isValidMainlandMobile(undefined) === false);

  let errCaught = false;
  try {
    normalizePhone('invalid_phone');
  } catch (e) {
    errCaught = e.statusCode === 400;
  }
  assert('非法号码调用 normalizePhone 抛出 400 异常', errCaught);
  assert('tryNormalizePhone 安全返回 null', tryNormalizePhone('invalid') === null);

  // ==========================================
  // 2. Verification Code Service Tests
  // ==========================================
  console.log('\n--- 2. 验证码生成、存储与校验测试 ---');

  const testStore = new MemoryVerificationCodeStore();
  setVerificationCodeStore(testStore);

  const code1 = generateVerificationCode();
  assert('验证码生成为 6 位纯数字', /^\d{6}$/.test(code1));

  const testPhone = '+8613911112222';
  await storeVerificationCode(testPhone, '654321', 300);

  // 错误验证码
  const wrongAttempt = await consumeVerificationCode(testPhone, '000000');
  assert('错误验证码校验失败并返回可尝试次数', wrongAttempt.valid === false && wrongAttempt.errorCode === 'INVALID_CODE');

  // 正确验证码
  const correctAttempt = await consumeVerificationCode(testPhone, '654321');
  assert('正确验证码校验成功', correctAttempt.valid === true);

  // 一次性消费原则：校验通过后立即失效
  const replayAttempt = await consumeVerificationCode(testPhone, '654321');
  assert('一次性使用：验证码成功后立即失效防重放', replayAttempt.valid === false && replayAttempt.errorCode === 'CODE_NOT_FOUND');

  // 5次失败销毁测试
  const phone5Times = '+8613988889999';
  await storeVerificationCode(phone5Times, '123456', 300);
  for (let i = 0; i < 4; i++) {
    await consumeVerificationCode(phone5Times, '999999');
  }
  const fifthAttempt = await consumeVerificationCode(phone5Times, '999999');
  assert('第 5 次输错后验证码立即强制注销作废', fifthAttempt.valid === false && fifthAttempt.errorCode === 'MAX_ATTEMPTS_EXCEEDED');
  const afterFifth = await consumeVerificationCode(phone5Times, '123456');
  assert('注销后即使输入原正确验证码亦失效', afterFifth.valid === false && afterFifth.errorCode === 'CODE_NOT_FOUND');

  // 过期测试
  const expiredPhone = '+8613900001111';
  await storeVerificationCode(expiredPhone, '111222', 1); // 1 秒过期
  await new Promise((r) => setTimeout(r, 1100));
  const expCheck = await consumeVerificationCode(expiredPhone, '111222');
  assert('过期验证码自动失效 (TTL)', expCheck.valid === false && expCheck.errorCode === 'CODE_NOT_FOUND');

  // ==========================================
  // 3. Rate Limiter Tests
  // ==========================================
  console.log('\n--- 3. 手机号与 IP 限流测试 ---');

  const limiter = new MemoryRateLimiter();
  const ratePhone = '+8613877778888';

  const check1 = await limiter.canSend(ratePhone);
  assert('首次请求允许发送', check1.allowed === true);
  await limiter.recordSend(ratePhone);

  const check2 = await limiter.canSend(ratePhone);
  assert('60 秒冷却期内再次请求被拦截', check2.allowed === false && check2.reason === 'COOLDOWN');

  // IP 限流
  const testIp = '192.168.1.100';
  for (let i = 0; i < 10; i++) {
    await limiter.checkIpLimit(testIp);
  }
  const ipCheckBlocked = await limiter.checkIpLimit(testIp);
  assert('单 IP 达到每小时 10 次上限被拦截', ipCheckBlocked.allowed === false && ipCheckBlocked.reason === 'IP_RATE_LIMITED');

  // 登录防暴力破解锁定
  const brutePhone = '+8613855556666';
  for (let i = 0; i < 5; i++) {
    await limiter.recordAttempt(brutePhone, false);
  }
  const attemptLock = await limiter.canAttempt(brutePhone);
  assert('连续 5 次登录失败后账号被临时锁定 15 分钟', attemptLock.allowed === false && attemptLock.reason === 'ACCOUNT_LOCKED');

  // ==========================================
  // 4. SMS Provider Tests
  // ==========================================
  console.log('\n--- 4. SMS Provider 驱动测试 ---');

  const devProvider = new DevConsoleSmsProvider();
  const devRes = await devProvider.sendVerificationCode('+8613800138000', '888888');
  assert('DevConsoleSmsProvider 正常输出并返回成功', devRes.success === true && !!devRes.messageId);

  const mockProvider = new MockSmsProvider();
  const mockRes = await mockProvider.sendVerificationCode('+8613800138000', '666666');
  assert('MockSmsProvider 发送成功并记录', mockRes.success === true);
  assert('MockSmsProvider 可捕获最后一条短信', mockProvider.getLastMessage()?.code === '666666');

  mockProvider.setSimulateFailure(true, '运营商网关超时');
  const mockFailRes = await mockProvider.sendVerificationCode('+8613800138000', '666666');
  assert('MockSmsProvider 支持模拟网络/服务商故障', mockFailRes.success === false && mockFailRes.error === '运营商网关超时');

  // ==========================================
  // 5. Existing Email Auth Regression Tests
  // ==========================================
  console.log('\n--- 5. 既有 Email 登录与 Session Rehydration 回归测试 ---');

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  try {
    // 现有邮箱登录
    const loginRes = await request('POST', '/api/v1/auth/login', {
      email: 'admin@admin',
      code: '123456',
    });
    assert('既有 Email 登录接口正常 200', loginRes.status === 200 && !!loginRes.data?.data?.accessToken);
    const token = loginRes.data.data.accessToken;
    const cookie = extractCookie(loginRes.cookies, 'refreshToken');

    // 既有刷新接口
    const refreshRes = await request(
      'POST',
      '/api/v1/auth/refresh',
      {},
      { Cookie: `refreshToken=${cookie}` }
    );
    assert('既有 Refresh Token 刷新正常 200', refreshRes.status === 200);
    assert('Refresh 恢复 user 实体完整', !!refreshRes.data?.data?.user?.id);

    // 既有登出
    const logoutRes = await request(
      'POST',
      '/api/v1/auth/logout',
      {},
      {
        Authorization: `Bearer ${token}`,
        Cookie: `refreshToken=${cookie}`,
      }
    );
    assert('既有 Logout 接口正常 200', logoutRes.status === 200);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log(`\n========================================`);
  console.log(`Phase 2.1 测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    throw new Error(`存在 ${failed} 项测试未通过！`);
  }
}

runAllTests()
  .then(() => {
    console.log('✅ Phase 2.1 基础设施与既有认证回归全部通过 (100% PASS)！');
  })
  .catch((err) => {
    console.error('测试异常:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
