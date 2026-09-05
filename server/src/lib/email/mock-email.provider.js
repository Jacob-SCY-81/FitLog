import crypto from 'crypto';
import { BaseEmailProvider } from './email.provider.js';

/**
 * 专供单元测试与 CI 运行的内存 Mock 邮件驱动
 */
export class MockEmailProvider extends BaseEmailProvider {
  constructor() {
    super();
    this.sentEmails = [];
    this.shouldFail = false;
    this.failError = 'Mock email failure';
  }

  async sendVerificationEmail(to, code, options = {}) {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failError,
        errorCode: 'MOCK_EMAIL_FAILED',
        statusCode: 502,
      };
    }

    const messageId = `mock-email-${crypto.randomUUID()}`;
    const record = {
      messageId,
      to,
      code,
      options,
      sentAt: new Date(),
    };

    this.sentEmails.push(record);

    return {
      success: true,
      messageId,
    };
  }

  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1] || null;
  }

  clear() {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}
