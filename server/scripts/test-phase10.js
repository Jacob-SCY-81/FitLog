import app from '../src/app.js';
import http from 'http';
import { maskSensitiveData, maskPhone, maskEmail, logger } from '../src/lib/logger/logger.js';
import { captureException } from '../src/lib/observability/error-tracker.js';

async function main() {
  console.log('--- 开始 Phase 10 可观测性与健康诊断专项测试 ---');

  // 1. 测试数据脱敏工具 (Sensitive Data Masking)
  console.log('[测试 1] 敏感信息自动脱敏校验...');
  const testPayload = {
    user: {
      phone: '13812345678',
      email: 'alex.fitness@example.com',
      password: 'PlainPassword123!',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'refresh_secret_token_abc',
      nested: {
        verificationCode: '654321',
        authorization: 'Bearer secret_jwt',
      },
    },
    action: 'USER_LOGIN',
  };

  const masked = maskSensitiveData(testPayload);

  if (masked.user.phone !== '138****5678') {
    throw new Error(`手机号脱敏错误: 预期 138****5678, 实际: ${masked.user.phone}`);
  }
  if (masked.user.password !== '[REDACTED]') {
    throw new Error(`密码未被成功脱敏: ${masked.user.password}`);
  }
  if (masked.user.token !== '[REDACTED]') {
    throw new Error(`Token 未被成功脱敏: ${masked.user.token}`);
  }
  if (masked.user.refreshToken !== '[REDACTED]') {
    throw new Error(`RefreshToken 未被成功脱敏: ${masked.user.refreshToken}`);
  }
  if (masked.user.nested.verificationCode !== '[REDACTED]') {
    throw new Error(`验证码未被成功脱敏: ${masked.user.nested.verificationCode}`);
  }
  if (masked.user.nested.authorization !== '[REDACTED]') {
    throw new Error(`Authorization 未被成功脱敏: ${masked.user.nested.authorization}`);
  }
  console.log('✓ 数据脱敏规则全部生效（密码/Token/验证码脱敏为 [REDACTED]，手机号中间掩码）');

  // 2. 启动服务测试端点与 Request ID
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 2.1 测试未携带 Request ID 时自动生成
    console.log('[测试 2] Request ID 自动生成与响应头注入...');
    const resAutoReq = await fetch(`${baseUrl}/health`);
    const autoReqId = resAutoReq.headers.get('x-request-id');
    if (!autoReqId || !autoReqId.startsWith('req_')) {
      throw new Error(`未正确生成 Request ID: ${autoReqId}`);
    }
    console.log(`✓ 自动生成链路追踪 Request ID: ${autoReqId}`);

    // 2.2 测试透传外部 Request ID
    console.log('[测试 3] 外部透传 Request ID 回显...');
    const customTraceId = 'trace_ext_99887766';
    const resCustomReq = await fetch(`${baseUrl}/health`, {
      headers: { 'X-Request-Id': customTraceId },
    });
    const echoedId = resCustomReq.headers.get('x-request-id');
    if (echoedId !== customTraceId) {
      throw new Error(`未正确回显外部 Request ID: 预期 ${customTraceId}, 实际 ${echoedId}`);
    }
    console.log(`✓ 外部 Request ID 透传成功回显: ${echoedId}`);

    // 2.3 测试健康检查三态端点
    console.log('[测试 4] 基础健康检查 /health & /api/v1/health...');
    const resHealth = await fetch(`${baseUrl}/api/v1/health`);
    const healthJson = await resHealth.json();
    if (healthJson.status !== 'ok' || typeof healthJson.uptime !== 'number') {
      throw new Error(`健康检查数据不符合规范: ${JSON.stringify(healthJson)}`);
    }
    console.log(`✓ 基础健康检查正常 (Uptime: ${healthJson.uptime}s, Env: ${healthJson.environment})`);

    console.log('[测试 5] Liveness 存活探针 /health/live...');
    const resLive = await fetch(`${baseUrl}/health/live`);
    const liveJson = await resLive.json();
    if (liveJson.status !== 'alive') {
      throw new Error(`存活探针异常: ${JSON.stringify(liveJson)}`);
    }
    console.log('✓ Liveness 存活探针正常');

    console.log('[测试 6] Readiness 就绪探针 /health/ready (深层依赖探测)...');
    const resReady = await fetch(`${baseUrl}/health/ready`);
    const readyJson = await resReady.json();
    if (resReady.status !== 200 || readyJson.status !== 'ready') {
      throw new Error(`就绪探针失败 (HTTP ${resReady.status}): ${JSON.stringify(readyJson)}`);
    }
    if (readyJson.checks.database.status !== 'healthy') {
      throw new Error(`数据库连通性异常: ${JSON.stringify(readyJson.checks.database)}`);
    }
    console.log(`✓ Readiness 就绪探针正常 (DB 状态: ${readyJson.checks.database.status}, 延迟: ${readyJson.checks.database.latencyMs}ms, Redis: ${readyJson.checks.redis.status})`);

    // 2.4 测试错误追踪抽象
    console.log('[测试 7] 错误追踪抽象测试...');
    const tracked = captureException(new Error('测试可观测性异常捕获'), {
      requestId: 'test_req_err_01',
      route: '/test/fail',
    });
    if (tracked.errorMessage !== '测试可观测性异常捕获' || tracked.requestId !== 'test_req_err_01') {
      throw new Error('错误追踪对象构建不符合预期');
    }
    console.log('✓ 错误追踪捕获器集成校验通过');

    console.log('\n========================================');
    console.log(' Phase 10 可观测性、脱敏与健康诊断全部通过！');
    console.log('========================================\n');
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Phase 10 测试失败:', err);
  process.exit(1);
});
