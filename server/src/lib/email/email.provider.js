/**
 * 邮件服务提供商基类抽象
 * 
 * 职责限定：
 * 负责向目标邮箱发送验证码或通知邮件。
 * 严禁耦合数据库持久化、JWT 签发或业务鉴权校验。
 */
export class BaseEmailProvider {
  /**
   * 发送登录验证码邮件
   * @param {string} to 目标邮箱地址
   * @param {string} code 6 位数字验证码
   * @param {object} [options] 扩展元数据 (如 traceId, clientIp)
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string, errorCode?: string, statusCode?: number }>}
   */
  async sendVerificationEmail(to, code, options = {}) {
    throw new Error('EmailProvider must implement sendVerificationEmail method.');
  }
}
