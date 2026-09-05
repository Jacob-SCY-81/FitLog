import { BaseSmsProvider } from './sms.provider.js';
import crypto from 'crypto';

/**
 * 本地开发环境短信驱动
 * 
 * 行为：
 * 在控制台打印高亮易读的短信通知格式，不发起任何外部网络请求，零资费消耗。
 */
export class DevConsoleSmsProvider extends BaseSmsProvider {
  async sendVerificationCode(normalizedPhone, code, options = {}) {
    const messageId = `dev-sms-${crypto.randomUUID()}`;
    const timestamp = new Date().toLocaleTimeString('zh-CN');

    console.log(`\n========================================`);
    console.log(`[DEV SMS] 时间: ${timestamp}`);
    console.log(`[DEV SMS] 发往: ${normalizedPhone}`);
    console.log(`[DEV SMS] 模板: 【FitLog】您的验证码为 ${code}，5分钟内有效。`);
    console.log(`[DEV SMS] ID:   ${messageId}`);
    console.log(`========================================\n`);

    if (process.env.SMS_DEV_LOG_FILE) {
      try {
        const fs = await import('fs');
        fs.appendFileSync(process.env.SMS_DEV_LOG_FILE, `${normalizedPhone}:${code}\n`);
      } catch {
        // ignore log file write error
      }
    }

    return {
      success: true,
      messageId,
    };
  }
}
