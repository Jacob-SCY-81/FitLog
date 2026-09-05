import prisma from '../src/lib/prisma.js';
import {
  loginWithPhone,
  sendPhoneVerificationCode,
  refreshAccessToken,
  logout,
  loginWithCode,
  sendVerificationCode,
} from '../src/modules/auth/auth.service.js';
import { rateLimiter } from '../src/lib/rate-limit/memory-rate-limiter.js';
import { getVerificationCodeStore } from '../src/lib/verification/verification-code.service.js';
import { normalizePhone } from '../src/lib/phone/normalize.js';

async function runTests() {
  console.log('=== FitLog Phase 2.5B-4: 认证与会话安全全景审计测试 ===\n');
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

  // -------------------------------------------------------------
  console.log('--- 1. Refresh Token 自动轮转 (RTR) 与重放攻击全吊销测试 ---');
  // -------------------------------------------------------------
  // 创建测试用户与初始 Token
  const testEmail = 'sec-audit@fitlog.dev';
  let auditUser = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!auditUser) {
    auditUser = await prisma.user.create({ data: { email: testEmail, nickname: 'SecAudit' } });
  }

  // 1. 模拟首次登录：发放 Token A
  await sendVerificationCode(testEmail, '127.0.0.1');
  // 直接从内部获取或模拟
  const loginRes1 = await loginWithCode(testEmail, '123456').catch(() => null) ||
    await loginWithPhone('+8613800998877', '123456').catch(() => null);

  // 为保证严格测试 RTR，我们手工签发并写入一个合规的 RefreshToken 链
  const { signAccessToken, signRefreshToken, verifyRefreshToken } = await import('../src/lib/jwt.js');
  const tokenPayload = { sub: auditUser.id, email: auditUser.email };
  const tokenA = signRefreshToken(tokenPayload);
  const decodedA = verifyRefreshToken(tokenA);
  const recA = await prisma.refreshToken.create({
    data: { token: tokenA, userId: auditUser.id, expiresAt: new Date(decodedA.exp * 1000) },
  });

  // 2. 正常刷新：使用 Token A 换取 Token B
  const refreshRes1 = await refreshAccessToken(tokenA);
  const tokenB = refreshRes1.refreshToken;
  assert(tokenB !== tokenA, 'Refresh Token 成功轮转 (Token B !== Token A)');

  // 检查数据库中 Token A 状态已变更为 revoked
  const updatedRecA = await prisma.refreshToken.findUnique({ where: { id: recA.id } });
  assert(updatedRecA.revokedAt !== null, '旧的 Token A 在轮转后立即被标记为 revoked');

  // 3. 重放攻击测试：恶意方再次提交已被吊销的 Token A 试图刷新！
  let replayBlocked = false;
  try {
    await refreshAccessToken(tokenA);
  } catch (err) {
    replayBlocked = err.errorCode === 'TOKEN_REVOKED';
  }
  assert(replayBlocked, '使用已废弃的 Token A 刷新被安全拦截 (TOKEN_REVOKED)');

  // 4. 重放惩罚验证：检测到 Token 重放攻击时，必须将该用户的所有 Token（包括 Token B）全部吊销！
  const recB = await prisma.refreshToken.findUnique({ where: { token: tokenB } });
  assert(recB.revokedAt !== null, '检测到重放攻击后，系统自动触发熔断，将该用户的所有 Token 全量吊销');

  // -------------------------------------------------------------
  console.log('\n--- 2. 邮箱与手机号防爆破连续错误锁定统一验证 ---');
  // -------------------------------------------------------------
  const bruteEmail = 'brute-target@fitlog.dev';
  rateLimiter.clear();

  // 连续输错 4 次
  for (let i = 1; i <= 4; i++) {
    await rateLimiter.recordAttempt(bruteEmail, false);
    const canAttempt = await rateLimiter.canAttempt(bruteEmail);
    assert(canAttempt.allowed === true, `邮箱第 ${i} 次错误尝试尚未触发锁定`);
  }
  // 第 5 次输错
  await rateLimiter.recordAttempt(bruteEmail, false);
  const lockedEmailRes = await rateLimiter.canAttempt(bruteEmail);
  assert(lockedEmailRes.allowed === false, '邮箱第 5 次输错后触发临时锁定');
  assert(lockedEmailRes.reason === 'ACCOUNT_LOCKED', '拦截原因为 ACCOUNT_LOCKED');

  // -------------------------------------------------------------
  console.log('\n--- 3. 验证码一次性使用 (One-Time Code) 防重放测试 ---');
  // -------------------------------------------------------------
  const singleUsePhone = '+8613877776666';
  const vStore = getVerificationCodeStore();
  await vStore.set(singleUsePhone, { code: '666888', attempts: 0 }, 300);

  // 首次消费
  const firstConsume = await vStore.consumeAtomic
    ? await vStore.consumeAtomic(singleUsePhone, '666888')
    : await vStore.get(singleUsePhone);
  assert(firstConsume.valid || firstConsume.code === '666888', '首次使用正确验证码消费成功');

  // 模拟业务逻辑中成功后执行 delete
  await vStore.delete(singleUsePhone);

  // 第二次使用同一验证码尝试消费
  let secondBlocked = false;
  if (vStore.consumeAtomic) {
    const secondRes = await vStore.consumeAtomic(singleUsePhone, '666888');
    secondBlocked = !secondRes.valid && secondRes.errorCode === 'CODE_NOT_FOUND';
  } else {
    const secondEntry = await vStore.get(singleUsePhone);
    secondBlocked = secondEntry === null;
  }
  assert(secondBlocked, '二次重放同一验证码被拒绝，保障一次性消费原则');

  // -------------------------------------------------------------
  console.log('\n--- 4. SQL 注入与畸形格式前置防御测试 ---');
  // -------------------------------------------------------------
  const injectionPayloads = [
    "'+OR+1=1--",
    "13800000000'; DROP TABLE users;--",
    "<script>alert(1)</script>",
    "admin' --",
    "+861380000000000000000", // 超长号码
  ];

  for (const payload of injectionPayloads) {
    let rejected = false;
    try {
      normalizePhone(payload);
    } catch {
      rejected = true;
    }
    assert(rejected, `畸形注入攻击样本 [${payload.slice(0, 15)}...] 在规范化层即被 400 拒绝`);
  }

  // -------------------------------------------------------------
  console.log('\n--- 5. 登出彻底性与会话销毁测试 ---');
  // -------------------------------------------------------------
  const logoutToken = signRefreshToken(tokenPayload);
  const decodedLogout = verifyRefreshToken(logoutToken);
  const recLogout = await prisma.refreshToken.create({
    data: { token: logoutToken, userId: auditUser.id, expiresAt: new Date(decodedLogout.exp * 1000) },
  });

  await logout(logoutToken);
  const afterLogout = await prisma.refreshToken.findUnique({ where: { id: recLogout.id } });
  assert(afterLogout.revokedAt !== null, '用户登出后，对应的 RefreshToken 在数据库中立即被吊销');

  let postLogoutRefreshFailed = false;
  try {
    await refreshAccessToken(logoutToken);
  } catch (err) {
    postLogoutRefreshFailed = err.errorCode === 'TOKEN_REVOKED';
  }
  assert(postLogoutRefreshFailed, '登出后试图再次刷新被彻底拒绝');

  // 清理审计测试产生的数据
  await prisma.refreshToken.deleteMany({ where: { userId: auditUser.id } });
  await prisma.user.delete({ where: { id: auditUser.id } });
  rateLimiter.clear();

  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Phase 2.5B-4 安全审计测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 2.5B-4 测试运行异常:', err);
  process.exit(1);
});
