import crypto from 'crypto';
import { RedisVerificationCodeStore } from '../src/lib/verification/redis-verification-code.store.js';
import { RedisRateLimiter } from '../src/lib/rate-limit/redis-rate-limiter.js';

/**
 * 针对 Phase 2.5B-1 的高拟真 Redis 模拟器
 * 严格支持 Redis Hash, String, Pipeline, TTL 以及核心原子 Lua 脚本的单线程原子执行
 */
class InMemoryRedisMock {
  constructor() {
    this.data = new Map();     // key -> value (string or map for hash)
    this.ttls = new Map();     // key -> expiresAt (timestamp)
    this.isBroken = false;     // 模拟连接中断
  }

  _isExpired(key) {
    const exp = this.ttls.get(key);
    if (exp && Date.now() > exp) {
      this.data.delete(key);
      this.ttls.delete(key);
      return true;
    }
    return false;
  }

  async hgetall(key) {
    if (this.isBroken) throw new Error('Redis connection lost');
    if (this._isExpired(key)) return {};
    const val = this.data.get(key);
    return (val instanceof Map) ? Object.fromEntries(val) : {};
  }

  async hincrby(key, field, increment) {
    if (this.isBroken) throw new Error('Redis connection lost');
    this._isExpired(key);
    let map = this.data.get(key);
    if (!map || !(map instanceof Map)) {
      map = new Map();
      this.data.set(key, map);
    }
    const cur = parseInt(map.get(field) || '0', 10) + increment;
    map.set(field, String(cur));
    return cur;
  }

  async set(key, value, mode, duration) {
    if (this.isBroken) throw new Error('Redis connection lost');
    this.data.set(key, String(value));
    if (mode === 'EX' && duration) {
      this.ttls.set(key, Date.now() + duration * 1000);
    }
    return 'OK';
  }

  async get(key) {
    if (this.isBroken) throw new Error('Redis connection lost');
    if (this._isExpired(key)) return null;
    return this.data.get(key) || null;
  }

  async ttl(key) {
    if (this.isBroken) throw new Error('Redis connection lost');
    if (this._isExpired(key)) return -2;
    const exp = this.ttls.get(key);
    if (!exp) return -1;
    const remaining = Math.ceil((exp - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async del(...keys) {
    if (this.isBroken) throw new Error('Redis connection lost');
    let count = 0;
    for (const k of keys) {
      if (this.data.delete(k)) count++;
      this.ttls.delete(k);
    }
    return count;
  }

  async keys(pattern) {
    if (this.isBroken) throw new Error('Redis connection lost');
    const result = [];
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    for (const k of this.data.keys()) {
      if (!this._isExpired(k) && regex.test(k)) {
        result.push(k);
      }
    }
    return result;
  }

  pipeline() {
    const commands = [];
    const mock = this;
    const pipe = {
      hset(key, obj) {
        commands.push(() => {
          mock._isExpired(key);
          let map = mock.data.get(key);
          if (!map || !(map instanceof Map)) {
            map = new Map();
            mock.data.set(key, map);
          }
          for (const [k, v] of Object.entries(obj)) {
            map.set(k, String(v));
          }
        });
        return pipe;
      },
      expire(key, sec) {
        commands.push(() => {
          mock.ttls.set(key, Date.now() + sec * 1000);
        });
        return pipe;
      },
      set(key, val, mode, sec) {
        commands.push(() => {
          mock.data.set(key, String(val));
          if (mode === 'EX' && sec) {
            mock.ttls.set(key, Date.now() + sec * 1000);
          }
        });
        return pipe;
      },
      eval(lua, numkeys, ...args) {
        commands.push(async () => {
          await mock.eval(lua, numkeys, ...args);
        });
        return pipe;
      },
      async exec() {
        if (mock.isBroken) throw new Error('Redis pipeline failed');
        for (const fn of commands) {
          await fn();
        }
        return commands.map(() => [null, 'OK']);
      }
    };
    return pipe;
  }

  // 关键：模拟 Redis 单线程原子执行 Lua 脚本
  async eval(lua, numkeys, ...args) {
    if (this.isBroken) throw new Error('Redis eval execution error');
    
    // 脚本 1: 验证码原子消费脚本
    if (lua.includes('CONSUME_CODE_LUA') || lua.includes('storedHash')) {
      const key = args[0];
      const inputHash = args[1];
      const maxAttempts = parseInt(args[2], 10);

      if (this._isExpired(key) || !this.data.has(key)) {
        return [0, 'CODE_NOT_FOUND'];
      }

      const map = this.data.get(key);
      const storedHash = map.get('hash');
      const attempts = parseInt(map.get('attempts') || '0', 10);

      if (attempts >= maxAttempts) {
        this.del(key);
        return [0, 'MAX_ATTEMPTS_EXCEEDED'];
      }

      if (storedHash === inputHash) {
        // 原子删除
        this.del(key);
        return [1, 'SUCCESS'];
      } else {
        const cur = attempts + 1;
        map.set('attempts', String(cur));
        if (cur >= maxAttempts) {
          this.del(key);
          return [0, 'MAX_ATTEMPTS_EXCEEDED'];
        }
        return [0, 'INVALID_CODE', cur];
      }
    }

    // 脚本 2: INCR + 首次 EXPIRE
    if (lua.includes('INCR') && lua.includes('current == 1')) {
      const key = args[0];
      const expireSec = parseInt(args[1], 10);
      this._isExpired(key);

      const cur = parseInt(this.data.get(key) || '0', 10) + 1;
      this.data.set(key, String(cur));
      if (cur === 1) {
        this.ttls.set(key, Date.now() + expireSec * 1000);
      }
      return cur;
    }

    // 脚本 3: 记录登录失败与锁定
    if (lua.includes('failKey') && lua.includes('lockKey')) {
      const failKey = args[0];
      const lockKey = args[1];
      const maxFails = parseInt(args[2], 10);
      const lockTtl = parseInt(args[3], 10);

      this._isExpired(failKey);
      this._isExpired(lockKey);

      const curFails = parseInt(this.data.get(failKey) || '0', 10) + 1;
      this.data.set(failKey, String(curFails));
      if (curFails === 1) {
        this.ttls.set(failKey, Date.now() + 600 * 1000);
      }

      if (curFails >= maxFails) {
        this.data.set(lockKey, '1');
        this.ttls.set(lockKey, Date.now() + lockTtl * 1000);
        this.data.delete(failKey);
        this.ttls.delete(failKey);
        return 1;
      }
      return 0;
    }

    throw new Error('Unsupported script in test mock');
  }
}

async function runTests() {
  console.log('=== FitLog Phase 2.5B-1: Redis 存储与分布式限流器全量验证 ===\n');
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

  const mockRedis = new InMemoryRedisMock();
  const store = new RedisVerificationCodeStore(mockRedis, { salt: 'test_salt' });
  const limiter = new RedisRateLimiter(mockRedis, { salt: 'test_salt' });

  // -------------------------------------------------------------
  console.log('--- 1. RedisVerificationCodeStore 基础功能测试 ---');
  // -------------------------------------------------------------
  const testPhone = '+8613800138000';
  const testCode = '654321';

  await store.set(testPhone, { code: testCode, attempts: 0 }, 300);
  const entry = await store.get(testPhone);
  assert(entry !== null, '成功从 Redis 读取验证码元数据');
  assert(entry.attempts === 0, '初始尝试次数为 0');
  assert(typeof entry.hash === 'string' && entry.hash.length > 20, '验证码存储为加盐摘要哈希，非明文');

  // 输错 1 次
  const wrongRes = await store.consumeAtomic(testPhone, '000000');
  assert(!wrongRes.valid, '输入错误验证码返回 valid=false');
  assert(wrongRes.errorCode === 'INVALID_CODE', '返回 INVALID_CODE 错误码');
  assert(wrongRes.remainingAttempts === 4, '正确计算并返回剩余尝试次数 (4次)');

  // 再次输错 4 次，达到 5 次上限自动作废
  await store.consumeAtomic(testPhone, '000001');
  await store.consumeAtomic(testPhone, '000002');
  await store.consumeAtomic(testPhone, '000003');
  const maxExceededRes = await store.consumeAtomic(testPhone, '000004');
  assert(maxExceededRes.errorCode === 'MAX_ATTEMPTS_EXCEEDED', '第 5 次输错后返回 MAX_ATTEMPTS_EXCEEDED');

  // 再次尝试，应已彻底被 DEL
  const notFoundRes = await store.consumeAtomic(testPhone, testCode);
  assert(notFoundRes.errorCode === 'CODE_NOT_FOUND', '达到上限后验证码已从 Redis 彻底销毁');

  // -------------------------------------------------------------
  console.log('\n--- 2. TOCTOU 高并发原子争抢测试 (Lua 脚本防重放) ---');
  // -------------------------------------------------------------
  const concurrentPhone = '+8613912345678';
  const concurrentCode = '888888';
  await store.set(concurrentPhone, { code: concurrentCode, attempts: 0 }, 300);

  // 模拟 10 个并发请求几乎在同一毫秒内到达，争抢消费同一个验证码
  const concurrentPromises = Array.from({ length: 10 }).map((_, idx) =>
    store.consumeAtomic(concurrentPhone, concurrentCode)
  );

  const results = await Promise.all(concurrentPromises);
  const successCount = results.filter((r) => r.valid === true).length;
  const failCount = results.filter((r) => r.valid === false && r.errorCode === 'CODE_NOT_FOUND').length;

  assert(successCount === 1, '高并发争抢下，有且仅有 1 个请求能成功消费验证码 (successCount === 1)');
  assert(failCount === 9, '其余 9 个并发请求全部被拦截 (CODE_NOT_FOUND)，彻底消除了 TOCTOU 竞态');

  // -------------------------------------------------------------
  console.log('\n--- 3. RedisRateLimiter 限流与防刷测试 ---');
  // -------------------------------------------------------------
  const limiterPhone = '+8613766668888';
  
  // 首次发送
  const canSend1 = await limiter.canSend(limiterPhone);
  assert(canSend1.allowed === true, '首次请求允许发送短信');

  // 记录发送
  await limiter.recordSend(limiterPhone);

  // 60 秒内再次请求，必须被拦截
  const canSend2 = await limiter.canSend(limiterPhone);
  assert(canSend2.allowed === false, '冷却期内再次请求被拦截');
  assert(canSend2.reason === 'COOLDOWN', '拦截原因为 COOLDOWN');
  assert(typeof canSend2.waitSec === 'number' && canSend2.waitSec > 0, '返回剩余等待秒数');

  // 单号每日限额测试 (配额 10 次)
  const quotaPhone = '+8613611112222';
  for (let i = 0; i < 10; i++) {
    await limiter.recordSend(quotaPhone);
  }
  // 清除 cooldown 仅保留配额检查
  const quotaPhoneHash = limiter.getPhoneHash(quotaPhone);
  await mockRedis.del(`sms:cooldown:${quotaPhoneHash}`);

  const canSendQuota = await limiter.canSend(quotaPhone);
  assert(canSendQuota.allowed === false, '达到每日 10 次上限后被拦截');
  assert(canSendQuota.reason === 'DAILY_QUOTA_EXCEEDED', '拦截原因为 DAILY_QUOTA_EXCEEDED');

  // 单 IP 每小时限额测试 (限额 10 次)
  const testIp = '192.168.1.100';
  for (let i = 0; i < 10; i++) {
    const res = await limiter.checkIpLimit(testIp);
    assert(res.allowed === true, `IP 第 ${i + 1} 次请求允许`);
  }
  const ipBlockedRes = await limiter.checkIpLimit(testIp);
  assert(ipBlockedRes.allowed === false, '第 11 次 IP 请求被拦截 (IP_RATE_LIMITED)');
  assert(ipBlockedRes.reason === 'IP_RATE_LIMITED', '拦截原因为 IP_RATE_LIMITED');

  // 连续登录失败锁定测试 (连续 5 次锁定 15 分钟)
  const lockPhone = '+8613500009999';
  for (let i = 1; i <= 4; i++) {
    await limiter.recordAttempt(lockPhone, false);
    const canAttempt = await limiter.canAttempt(lockPhone);
    assert(canAttempt.allowed === true, `第 ${i} 次输错后尚未锁定`);
  }
  // 第 5 次输错
  await limiter.recordAttempt(lockPhone, false);
  const lockedRes = await limiter.canAttempt(lockPhone);
  assert(lockedRes.allowed === false, '第 5 次输错后账号被锁定');
  assert(lockedRes.reason === 'ACCOUNT_LOCKED', '锁定原因为 ACCOUNT_LOCKED');
  assert(lockedRes.waitMinutes === 15, '锁定时间为 15 分钟');

  // 成功登录后解锁
  await limiter.recordAttempt(lockPhone, true);
  const unlockedRes = await limiter.canAttempt(lockPhone);
  assert(unlockedRes.allowed === true, '登录成功后失败状态与锁定即刻解除');

  // -------------------------------------------------------------
  console.log('\n--- 4. Fail-Closed 容灾拦截测试 (Redis 故障防御) ---');
  // -------------------------------------------------------------
  // 模拟 Redis 服务中断
  mockRedis.isBroken = true;

  const failClosedSend = await limiter.canSend('+8613899990000');
  assert(failClosedSend.allowed === false, 'Redis 异常时 canSend 坚决 Fail-Closed，拒绝放行短信');
  assert(failClosedSend.reason === 'RATE_LIMIT_ERROR', '正确返回 RATE_LIMIT_ERROR');

  const failClosedIp = await limiter.checkIpLimit('10.0.0.1');
  assert(failClosedIp.allowed === false, 'Redis 异常时 checkIpLimit 执行 Fail-Closed 拦截');

  // 恢复状态
  mockRedis.isBroken = false;

  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Phase 2.5B-1 测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
