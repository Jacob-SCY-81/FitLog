import crypto from 'crypto';
import { BaseEmailProvider } from './email.provider.js';
import { maskEmail } from './smtp-email.provider.js';

/**
 * 本地开发环境控制台邮件驱动
 */
export class DevConsoleEmailProvider extends BaseEmailProvider {
  async sendVerificationEmail(to, code, options = {}) {
    const messageId = `dev-email-${crypto.randomUUID()}`;
    const timestamp = new Date().toLocaleTimeString('zh-CN');

    console.log(`\n========================================`);
    console.log(`[DEV EMAIL] 时间: ${timestamp}`);
    console.log(`[DEV EMAIL] 发往: ${to}`);
    console.log(`[DEV EMAIL] 验证码: ${code}`);
    console.log(`[DEV EMAIL] ID:   ${messageId}`);
    console.log(`========================================\n`);

    if (process.env.EMAIL_DEV_LOG_FILE) {
      try {
        const fs = await import('fs');
        fs.appendFileSync(process.env.EMAIL_DEV_LOG_FILE, `${to}:${code}\n`);
      } catch {
        // ignore log error
      }
    }

    return {
      success: true,
      messageId,
    };
  }
}
