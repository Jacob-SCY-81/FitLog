import { BaseSmsProvider } from './sms.provider.js';
import crypto from 'crypto';

/**
 * 自动化测试专用短信驱动
 * 
 * 行为：
 * 在内存数组中记录发送历史，供测试脚本与断言捕获验证。
 */
export class MockSmsProvider extends BaseSmsProvider {
  constructor() {
    super();
    this.sentMessages = [];
    this.shouldFail = false;
    this.failureError = 'Mock SMS network timeout';
  }

  async sendVerificationCode(normalizedPhone, code, options = {}) {
    if (this.shouldFail) {
      return {
        success: false,
        messageId: '',
        error: this.failureError,
      };
    }

    const messageId = `mock-sms-${crypto.randomUUID()}`;
    const record = {
      messageId,
      phone: normalizedPhone,
      code,
      options,
      sentAt: new Date(),
    };

    this.sentMessages.push(record);

    return {
      success: true,
      messageId,
    };
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1] || null;
  }

  getMessagesForPhone(phone) {
    return this.sentMessages.filter((m) => m.phone === phone);
  }

  clear() {
    this.sentMessages = [];
    this.shouldFail = false;
  }

  setSimulateFailure(shouldFail, error = 'Mock SMS network timeout') {
    this.shouldFail = shouldFail;
    this.failureError = error;
  }
}
