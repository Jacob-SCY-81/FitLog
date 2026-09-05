import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { BaseEmailProvider } from './email.provider.js';

/**
 * 邮箱地址脱敏工具函数
 * @param {string} email 
 * @returns {string} 脱敏后的邮箱 (e.g. a***n@admin.com)
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***';
  }
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

/**
 * 常见 SMTP 错误码映射
 */
const SMTP_ERROR_MAPPING = {
  EAUTH: {
    code: 'EMAIL_AUTH_FAILED',
    message: '邮件服务认证失败，请联系管理员',
    status: 500,
  },
  ECONNREFUSED: {
    code: 'EMAIL_SERVER_UNREACHABLE',
    message: '邮件服务器无法连接',
    status: 502,
  },
  ETIMEDOUT: {
    code: 'EMAIL_TIMEOUT',
    message: '邮件服务响应超时，请稍后重试',
    status: 504,
  },
  ESOCKET: {
    code: 'EMAIL_SOCKET_ERROR',
    message: '邮件通信网络异常',
    status: 502,
  },
};

/**
 * 生产级 SMTP 邮件提供商驱动
 */
export class SmtpEmailProvider extends BaseEmailProvider {
  /**
   * @param {object} [options] 
   */
  constructor(options = {}) {
    super();
    this.host = options.host || process.env.SMTP_HOST;
    this.port = parseInt(options.port || process.env.SMTP_PORT || '587', 10);
    this.secure = options.secure ?? (process.env.SMTP_SECURE === 'true');
    this.user = options.user || process.env.SMTP_USER;
    this.pass = options.pass || process.env.SMTP_PASS;
    this.from = options.from || process.env.SMTP_FROM || 'FitLog <noreply@fitlog.dev>';
    this.connectionTimeout = options.connectionTimeout || 3000;
    this.socketTimeout = options.socketTimeout || 5000;
    this.dryRun = options.dryRun ?? (process.env.EMAIL_DRY_RUN === 'true');

    this._transporter = null;
  }

  /**
   * 检查必要凭据是否完备
   * @returns {{ valid: boolean, error?: string }}
   */
  checkCredentials() {
    if (!this.dryRun) {
      if (!this.host || !this.user || !this.pass) {
        return { valid: false, error: 'SMTP 主机地址或认证凭据未配置完整' };
      }
    }
    return { valid: true };
  }

  /**
   * 获取或初始化底层 nodemailer transporter
   */
  getTransporter() {
    if (this._transporter) return this._transporter;

    this._transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.user,
        pass: this.pass,
      },
      connectionTimeout: this.connectionTimeout,
      greetingTimeout: this.connectionTimeout,
      socketTimeout: this.socketTimeout,
    });

    return this._transporter;
  }

  /**
   * 构造验证码邮件的 HTML 与 Text 内容
   * @param {string} code 
   * @returns {{ text: string, html: string }}
   */
  renderTemplate(code) {
    const text = `您的 FitLog 登录验证码是 ${code}。该验证码在 10 分钟内有效。如非本人操作，请忽略此邮件。`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1f2937; max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #059669; margin: 0; font-size: 22px;">FitLog 训练记录</h2>
          <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">专业力量与健身追踪</p>
        </div>
        <p style="font-size: 15px; line-height: 1.5;">您好，</p>
        <p style="font-size: 14px; color: #4b5563;">您正在申请邮箱安全登录，验证码如下：</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 28px; border-radius: 8px; display: inline-block;">
            ${code}
          </span>
        </div>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.4;">
          * 该验证码有效时间为 <strong>10 分钟</strong>。<br/>
          * 如果这不是您的操作，请忽略本邮件，账号安全不受影响。
        </p>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0 16px;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
          本邮件由系统安全自动发送，请勿直接回复。
        </p>
      </div>
    `;
    return { text, html };
  }

  /**
   * 发送登录验证码邮件
   * @param {string} to 
   * @param {string} code 
   * @param {object} [options] 
   */
  async sendVerificationEmail(to, code, options = {}) {
    const traceId = options.traceId || crypto.randomUUID();
    const masked = maskEmail(to);

    // 1. 入参校验
    if (!to || !to.includes('@') || !code || code.length < 4) {
      return {
        success: false,
        error: '无效的邮箱地址或验证码',
        errorCode: 'INVALID_PARAMETERS',
        statusCode: 400,
      };
    }

    // 2. 凭据校验
    const credCheck = this.checkCredentials();
    if (!credCheck.valid) {
      console.error(`[EMAIL_PROD][${traceId}] 凭据缺失: ${credCheck.error}`);
      return {
        success: false,
        error: '邮件发送服务配置未就绪',
        errorCode: 'CREDENTIALS_MISSING',
        statusCode: 500,
      };
    }

    // 3. DRY_RUN 仿真模式
    if (this.dryRun) {
      const mockMessageId = `mock-email-${crypto.randomUUID()}`;
      console.log(`[EMAIL_PROD][DRY_RUN][${traceId}] 成功模拟投递至 ${masked}, MessageId: ${mockMessageId}`);
      return {
        success: true,
        messageId: mockMessageId,
      };
    }

    // 4. 真实 SMTP 投递
    try {
      const transporter = options.transporter || this.getTransporter();
      const { text, html } = this.renderTemplate(code);

      const info = await transporter.sendMail({
        from: this.from,
        to,
        subject: '[FitLog] 您的登录验证码',
        text,
        html,
      });

      console.log(`[EMAIL_PROD][${traceId}] 邮件已成功投递至 ${masked}, MessageId: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      console.error(`[EMAIL_PROD][${traceId}] 发送失败至 ${masked}: [${err.code || 'UNKNOWN'}] ${err.message}`);
      
      const mapped = SMTP_ERROR_MAPPING[err.code] || {
        code: 'EMAIL_SEND_FAILED',
        message: '邮件发送失败，请稍后重试',
        status: 502,
      };

      return {
        success: false,
        errorCode: mapped.code,
        error: mapped.message,
        statusCode: mapped.status,
      };
    }
  }
}
