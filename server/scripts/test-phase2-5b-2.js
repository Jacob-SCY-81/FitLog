import { AliyunSmsProvider, maskPhone } from '../src/lib/sms/aliyun-sms.provider.js';
import { getSmsProvider, setSmsProvider } from '../src/lib/sms/index.js';

async function runTests() {
  console.log('=== FitLog Phase 2.5B-2: 生产 SMS 驱动与安全防护测试 ===\n');
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
  console.log('--- 1. 手机号脱敏工具函数测试 ---');
  // -------------------------------------------------------------
  assert(maskPhone('+8613800138000') === '+86138****8000', '标准 +86 手机号正确脱敏显示');
  assert(maskPhone('13912345678') === '139****5678', '11 位手机号正确脱敏显示');
  assert(maskPhone('') === '***', '空号码安全脱敏');
  assert(maskPhone(null) === '***', 'null 号码安全脱敏');

  // -------------------------------------------------------------
  console.log('\n--- 2. 入参防御校验测试 ---');
  // -------------------------------------------------------------
  const provider = new AliyunSmsProvider({ dryRun: true });
  
  const invalidCodeRes = await provider.sendVerificationCode('+8613800138000', '123'); // 长度不足 6 位
  assert(invalidCodeRes.success === false, '验证码长度非 6 位被拦截');
  assert(invalidCodeRes.errorCode === 'INVALID_PARAMETERS', '返回 INVALID_PARAMETERS 错误码');

  const emptyPhoneRes = await provider.sendVerificationCode('', '123456');
  assert(emptyPhoneRes.success === false, '空手机号被拦截');

  // -------------------------------------------------------------
  console.log('\n--- 3. 凭据缺失检查测试 ---');
  // -------------------------------------------------------------
  const unconfiguredProvider = new AliyunSmsProvider({
    dryRun: false,
    accessKeyId: '',
    accessKeySecret: '',
  });
  const credRes = await unconfiguredProvider.sendVerificationCode('+8613800138000', '123456');
  assert(credRes.success === false, '未配置凭据时安全拦截');
  assert(credRes.errorCode === 'CREDENTIALS_MISSING', '返回 CREDENTIALS_MISSING 错误码');

  // -------------------------------------------------------------
  console.log('\n--- 4. DRY_RUN 仿真模式测试 (零网络与资费) ---');
  // -------------------------------------------------------------
  const dryRunProvider = new AliyunSmsProvider({
    dryRun: true,
    signName: 'FitLog',
    templateCode: 'SMS_123456',
  });
  const dryRunRes = await dryRunProvider.sendVerificationCode('+8613800138000', '888888');
  assert(dryRunRes.success === true, 'DRY_RUN 模式下成功模拟发送');
  assert(dryRunRes.messageId.startsWith('mock-aliyun-'), '生成合规的模拟 messageId');

  // -------------------------------------------------------------
  console.log('\n--- 5. 供应商错误码安全脱敏映射测试 ---');
  // -------------------------------------------------------------
  const mockValidProvider = new AliyunSmsProvider({
    dryRun: false,
    accessKeyId: 'test-ak',
    accessKeySecret: 'test-sk',
    signName: 'FitLog',
    templateCode: 'SMS_123',
  });

  // 测试 A: 频控拦截
  const freqRes = await mockValidProvider.sendVerificationCode('+8613800138000', '123456', {
    httpCaller: async () => ({ Code: 'isv.BUSINESS_LIMIT_CONTROL', Message: '业务限流' }),
  });
  assert(freqRes.success === false, '业务限流正确拦截');
  assert(freqRes.errorCode === 'SMS_FREQUENCY_LIMITED', '正确映射为 SMS_FREQUENCY_LIMITED');
  assert(freqRes.statusCode === 429, '状态码映射为 429');

  // 测试 B: 单日限额超限
  const dailyRes = await mockValidProvider.sendVerificationCode('+8613800138000', '123456', {
    httpCaller: async () => ({ Code: 'isv.DAY_LIMIT_CONTROL', Message: '超出日上限' }),
  });
  assert(dailyRes.errorCode === 'SMS_DAILY_LIMIT_EXCEEDED', '正确映射为 SMS_DAILY_LIMIT_EXCEEDED');

  // 测试 C: 账户欠费
  const balanceRes = await mockValidProvider.sendVerificationCode('+8613800138000', '123456', {
    httpCaller: async () => ({ Code: 'isv.AMOUNT_NOT_ENOUGH', Message: '余额不足' }),
  });
  assert(balanceRes.errorCode === 'SMS_SERVICE_UNAVAILABLE', '正确映射为 SMS_SERVICE_UNAVAILABLE (503)');

  // 测试 D: 成功返回
  const successRes = await mockValidProvider.sendVerificationCode('+8613800138000', '123456', {
    httpCaller: async () => ({ Code: 'OK', BizId: 'biz_9988776655' }),
  });
  assert(successRes.success === true, '供应商返回 OK 时解析为成功');
  assert(successRes.messageId === 'biz_9988776655', '正确解析 BizId 为 messageId');

  // -------------------------------------------------------------
  console.log('\n--- 6. 超时保护 (AbortController) 与网络异常测试 ---');
  // -------------------------------------------------------------
  const timeoutProvider = new AliyunSmsProvider({
    dryRun: false,
    accessKeyId: 'test-ak',
    accessKeySecret: 'test-sk',
    signName: 'FitLog',
    templateCode: 'SMS_123',
    timeoutMs: 50, // 设定 50ms 超时用于单测
  });

  const timeoutRes = await timeoutProvider.sendVerificationCode('+8613800138000', '123456', {
    httpCaller: async (_, { signal }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ Code: 'OK' }), 200);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    },
  });
  assert(timeoutRes.success === false, '超过设定的超时时间被安全中断');
  assert(timeoutRes.errorCode === 'SMS_TIMEOUT', '错误码标记为 SMS_TIMEOUT');
  assert(timeoutRes.statusCode === 504, '状态码映射为 504 Gateway Timeout');

  // -------------------------------------------------------------
  console.log('\n--- 7. 短信驱动工厂多模式装配测试 ---');
  // -------------------------------------------------------------
  const originalEnv = process.env.SMS_PROVIDER;
  process.env.SMS_PROVIDER = 'aliyun';
  setSmsProvider(null); // 重置单例
  const activeProdProvider = getSmsProvider();
  assert(activeProdProvider instanceof AliyunSmsProvider, '配置 SMS_PROVIDER=aliyun 时正确装配 AliyunSmsProvider');

  // 还原
  process.env.SMS_PROVIDER = originalEnv;
  setSmsProvider(null);

  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Phase 2.5B-2 测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 2.5B-2 测试运行异常:', err);
  process.exit(1);
});
