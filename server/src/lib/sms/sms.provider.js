/**
 * SmsProvider 基类接口
 * 
 * 职责限定：
 * 仅负责向指定规范化手机号发送包含验证码的文本短信。
 * 严禁耦合数据库、JWT、登录逻辑或验证码校验。
 */
export class BaseSmsProvider {
  /**
   * 发送短信验证码
   * @param {string} normalizedPhone 格式化后的手机号 (+86138xxxxxxxx)
   * @param {string} code 6 位数字验证码
   * @param {object} [options] 扩展元数据 (如 traceId, clientIp, templateParam 等)
   * @returns {Promise<{ success: boolean, messageId: string, error?: string }>}
   */
  async sendVerificationCode(normalizedPhone, code, options = {}) {
    throw new Error('SmsProvider must implement sendVerificationCode method.');
  }
}
