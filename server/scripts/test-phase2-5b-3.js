import { SmtpEmailProvider, maskEmail } from '../src/lib/email/smtp-email.provider.js';
import { DevConsoleEmailProvider } from '../src/lib/email/dev-console-email.provider.js';
import { MockEmailProvider } from '../src/lib/email/mock-email.provider.js';
import { getEmailProvider, setEmailProvider } from '../src/lib/email/index.js';

async function runTests() {
  console.log('=== FitLog Phase 2.5B-3: 邮件驱动生产加固与安全测试 ===\n');
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
  console.log('--- 1. 邮箱脱敏工具函数测试 ---');
  // -------------------------------------------------------------
  assert(maskEmail('admin@admin.com') === 'a***n@admin.com', '多字符前缀正确脱敏');
  assert(maskEmail('ab@test.com') === 'a***@test.com', '两字符前缀安全脱敏');
  assert(maskEmail('invalid-email') === '***', '无 @ 符号的非规范输入安全脱敏');
  assert(maskEmail('') === '***', '空输入安全脱敏');

  // -------------------------------------------------------------
  console.log('\n--- 2. 入参防御校验测试 ---');
  // -------------------------------------------------------------
  const provider = new SmtpEmailProvider({ dryRun: true });
  
  const invalidEmailRes = await provider.sendVerificationEmail('not-an-email', '123456');
  assert(invalidEmailRes.success === false, '非法邮箱地址被拦截');
  assert(invalidEmailRes.errorCode === 'INVALID_PARAMETERS', '返回 INVALID_PARAMETERS 错误码');

  const shortCodeRes = await provider.sendVerificationEmail('user@test.com', '12');
  assert(shortCodeRes.success === false, '验证码长度异常被拦截');

  // -------------------------------------------------------------
  console.log('\n--- 3. 凭据缺失拦截测试 ---');
  // -------------------------------------------------------------
  const unconfiguredProvider = new SmtpEmailProvider({
    dryRun: false,
    host: '',
    user: '',
    pass: '',
  });
  const credRes = await unconfiguredProvider.sendVerificationEmail('user@test.com', '123456');
  assert(credRes.success === false, '凭据不全时在生产模式下安全拦截');
  assert(credRes.errorCode === 'CREDENTIALS_MISSING', '返回 CREDENTIALS_MISSING 错误码');

  // -------------------------------------------------------------
  console.log('\n--- 4. DRY_RUN 仿真模式测试 (免 SMTP 真实发送) ---');
  // -------------------------------------------------------------
  const dryRunProvider = new SmtpEmailProvider({
    dryRun: true,
    host: 'smtp.example.com',
  });
  const dryRunRes = await dryRunProvider.sendVerificationEmail('user@test.com', '654321');
  assert(dryRunRes.success === true, 'DRY_RUN 模式下成功模拟发送');
  assert(dryRunRes.messageId.startsWith('mock-email-'), '生成合规的模拟 messageId');

  // -------------------------------------------------------------
  console.log('\n--- 5. 邮件 HTML/Text 模板渲染测试 ---');
  // -------------------------------------------------------------
  const { text, html } = provider.renderTemplate('998877');
  assert(text.includes('998877'), '文本邮件包含验证码明文');
  assert(text.includes('10 分钟'), '文本邮件包含有效时间说明');
  assert(html.includes('998877'), 'HTML 邮件包含加粗高亮验证码');
  assert(html.includes('FitLog 训练记录'), 'HTML 邮件包含品牌 Header');

  // -------------------------------------------------------------
  console.log('\n--- 6. SMTP 异常安全脱敏映射测试 ---');
  // -------------------------------------------------------------
  const mockSmtp = new SmtpEmailProvider({
    dryRun: false,
    host: 'smtp.test.com',
    user: 'u',
    pass: 'p',
  });

  // 模拟 EAUTH 认证失败
  const authFailRes = await mockSmtp.sendVerificationEmail('user@test.com', '123456', {
    transporter: {
      sendMail: async () => {
        const err = new Error('Invalid login');
        err.code = 'EAUTH';
        throw err;
      },
    },
  });
  assert(authFailRes.success === false, '认证失败被捕获');
  assert(authFailRes.errorCode === 'EMAIL_AUTH_FAILED', '正确映射为 EMAIL_AUTH_FAILED');
  assert(authFailRes.statusCode === 500, '状态码映射为 500');

  // 模拟 ETIMEDOUT 超时
  const timeoutRes = await mockSmtp.sendVerificationEmail('user@test.com', '123456', {
    transporter: {
      sendMail: async () => {
        const err = new Error('Connection timed out');
        err.code = 'ETIMEDOUT';
        throw err;
      },
    },
  });
  assert(timeoutRes.errorCode === 'EMAIL_TIMEOUT', '正确映射为 EMAIL_TIMEOUT');
  assert(timeoutRes.statusCode === 504, '状态码映射为 504 Gateway Timeout');

  // 模拟成功投递
  const successRes = await mockSmtp.sendVerificationEmail('user@test.com', '123456', {
    transporter: {
      sendMail: async () => ({ messageId: '<msg_12345@fitlog.dev>' }),
    },
  });
  assert(successRes.success === true, '发送成功返回 true');
  assert(successRes.messageId === '<msg_12345@fitlog.dev>', '正确传递 messageId');

  // -------------------------------------------------------------
  console.log('\n--- 7. MockEmailProvider 与 DevConsoleEmailProvider 功能测试 ---');
  // -------------------------------------------------------------
  const mockProvider = new MockEmailProvider();
  await mockProvider.sendVerificationEmail('mock@fitlog.dev', '112233');
  assert(mockProvider.sentEmails.length === 1, 'MockEmailProvider 记录了发送的邮件');
  assert(mockProvider.getLastEmail().code === '112233', '记录内容与入参一致');

  const devConsole = new DevConsoleEmailProvider();
  const consoleRes = await devConsole.sendVerificationEmail('dev@fitlog.dev', '334455');
  assert(consoleRes.success === true, 'DevConsoleEmailProvider 发送成功');

  // -------------------------------------------------------------
  console.log('\n--- 8. 邮件工厂函数多模式装配测试 ---');
  // -------------------------------------------------------------
  const origEnv = process.env.EMAIL_PROVIDER;
  process.env.EMAIL_PROVIDER = 'smtp';
  setEmailProvider(null);
  assert(getEmailProvider() instanceof SmtpEmailProvider, '配置 EMAIL_PROVIDER=smtp 正确装配 SmtpEmailProvider');

  process.env.EMAIL_PROVIDER = 'mock';
  setEmailProvider(null);
  assert(getEmailProvider() instanceof MockEmailProvider, '配置 EMAIL_PROVIDER=mock 正确装配 MockEmailProvider');

  process.env.EMAIL_PROVIDER = 'console';
  setEmailProvider(null);
  assert(getEmailProvider() instanceof DevConsoleEmailProvider, '配置 EMAIL_PROVIDER=console 正确装配 DevConsoleEmailProvider');

  // 还原
  process.env.EMAIL_PROVIDER = origEnv;
  setEmailProvider(null);

  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Phase 2.5B-3 测试汇总: 通过 ${passed}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 2.5B-3 测试运行异常:', err);
  process.exit(1);
});
