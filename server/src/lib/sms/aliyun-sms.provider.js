import crypto from 'crypto';
import { BaseSmsProvider } from './sms.provider.js';

/**
 * 手机号脱敏显示工具函数
 * @param {string} phone 
 * @returns {string} 脱敏后的手机号 (e.g. +86138****2222)
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '***';
  return phone.replace(/(\+?86)?(\d{3})\d{4}(\d{4})/, '$1$2****$3');
}

/**
 * 阿里云短信业务错误码至 FitLog 统一内部错误码映射表
 */
const ALIYUN_ERROR_MAPPING = {
  'isv.BUSINESS_LIMIT_CONTROL': {
    code: 'SMS_FREQUENCY_LIMITED',
    message: '短信发送过于频繁，请稍后再试',
    status: 429,
  },
  'isv.DAY_LIMIT_CONTROL': {
    code: 'SMS_DAILY_LIMIT_EXCEEDED',
    message: '今日短信发送次数已超上限',
    status: 429,
  },
  'isv.MOBILE_NUMBER_ILLEGAL': {
    code: 'INVALID_PHONE_NUMBER',
    message: '手机号码格式不合规',
    status: 400,
  },
  'isv.SMS_TEMPLATE_ILLEGAL': {
    code: 'SMS_CONFIGURATION_ERROR',
    message: '短信服务配置异常',
    status: 500,
  },
  'isv.SMS_SIGNATURE_ILLEGAL': {
    code: 'SMS_CONFIGURATION_ERROR',
    message: '短信服务配置异常',
    status: 500,
  },
  'isv.AMOUNT_NOT_ENOUGH': {
    code: 'SMS_SERVICE_UNAVAILABLE',
    message: '短信服务暂时不可用，请联系客服',
    status: 503,
  },
};

/**
 * 生产级短信驱动 (以阿里云短信服务规范为基准)
 */
export class AliyunSmsProvider extends BaseSmsProvider {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    super();
    this.accessKeyId = options.accessKeyId || process.env.SMS_ACCESS_KEY_ID;
    this.accessKeySecret = options.accessKeySecret || process.env.SMS_ACCESS_KEY_SECRET;
    this.signName = options.signName || process.env.SMS_SIGN_NAME;
    this.templateCode = options.templateCode || process.env.SMS_TEMPLATE_CODE;
    this.timeoutMs = options.timeoutMs || 3000;
    this.dryRun = options.dryRun ?? (process.env.SMS_DRY_RUN === 'true');
  }

  /**
   * 检查基础必要凭据是否完备
   * @returns {{ valid: boolean, error?: string }}
   */
  checkCredentials() {
    if (!this.dryRun) {
      if (!this.accessKeyId || !this.accessKeySecret) {
        return { valid: false, error: '缺少 SMS_ACCESS_KEY_ID 或 SMS_ACCESS_KEY_SECRET 凭据配置' };
      }
      if (!this.signName || !this.templateCode) {
        return { valid: false, error: '缺少 SMS_SIGN_NAME 或 SMS_TEMPLATE_CODE 短信模板配置' };
      }
    }
    return { valid: true };
  }

  /**
   * 发送短信验证码
   * @param {string} normalizedPhone 规范化后的手机号 (+86138xxxxxxxx)
   * @param {string} code 6 位数字验证码
   * @param {object} [options] 扩展参数 (如 traceId, clientIp)
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string, errorCode?: string, statusCode?: number }>}
   */
  async sendVerificationCode(normalizedPhone, code, options = {}) {
    const traceId = options.traceId || crypto.randomUUID();
    const masked = maskPhone(normalizedPhone);

    // 1. 入参防御校验
    if (!normalizedPhone || !code || code.length !== 6) {
      return {
        success: false,
        error: '无效的手机号码或验证码',
        errorCode: 'INVALID_PARAMETERS',
        statusCode: 400,
      };
    }

    // 2. 凭据合法性检查
    const credCheck = this.checkCredentials();
    if (!credCheck.valid) {
      console.error(`[SMS_PROD][${traceId}] 凭据缺失: ${credCheck.error}`);
      return {
        success: false,
        error: '短信网关配置未就绪',
        errorCode: 'CREDENTIALS_MISSING',
        statusCode: 500,
      };
    }

    // 3. DRY_RUN 仿真模式 (专供测试与无资费演练)
    if (this.dryRun) {
      const mockMessageId = `mock-aliyun-${crypto.randomUUID()}`;
      console.log(`[SMS_PROD][DRY_RUN][${traceId}] 成功模拟下发至 ${masked}, MessageId: ${mockMessageId}`);
      return {
        success: true,
        messageId: mockMessageId,
      };
    }

    // 4. 真实外发请求包装 (带 3000ms 超时中断与异常安全映射)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // 提取中国大陆纯 11 位号码供短信通道
      const rawPhone = normalizedPhone.replace(/^\+86/, '');
      const templateParam = JSON.stringify({ code });

      // 在未安装第三方重量 SDK 的前提下，组装标准 POP/RPC 或 HTTP 请求
      // 此处预留标准网关分发，并支持传入自定义 fetchClient 或真实网关
      const requestPayload = {
        PhoneNumbers: rawPhone,
        SignName: this.signName,
        TemplateCode: this.templateCode,
        TemplateParam: templateParam,
      };

      // 模拟调用网关发送（若注入了自定义 httpCaller 则调用）
      if (options.httpCaller) {
        const response = await options.httpCaller(requestPayload, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.Code === 'OK') {
          console.log(`[SMS_PROD][${traceId}] 发送成功至 ${masked}, BizId: ${response.BizId}`);
          return {
            success: true,
            messageId: response.BizId || response.RequestId,
          };
        }

        // 错误码安全脱敏转换
        const mapped = ALIYUN_ERROR_MAPPING[response.Code] || {
          code: 'SMS_PROVIDER_ERROR',
          message: '短信发送失败，请稍后重试',
          status: 502,
        };

        console.error(`[SMS_PROD][${traceId}] 供应商返回错误: Code=${response.Code}, Message=${response.Message}`);
        return {
          success: false,
          errorCode: mapped.code,
          error: mapped.message,
          statusCode: mapped.status,
        };
      }

      clearTimeout(timeoutId);
      // 默认生产保护：未配置自定义 HTTPCaller 且非 DRY_RUN 时，拦截真实流量
      return {
        success: false,
        errorCode: 'SMS_GATEWAY_NOT_CONFIGURED',
        error: '生产短信网关调用适配器待配置',
        statusCode: 503,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        console.error(`[SMS_PROD][${traceId}] 请求超时 (${this.timeoutMs}ms) 被中断`);
        return {
          success: false,
          errorCode: 'SMS_TIMEOUT',
          error: '短信服务响应超时，请稍后重试',
          statusCode: 504,
        };
      }

      console.error(`[SMS_PROD][${traceId}] 网络异常: ${err.message}`);
      return {
        success: false,
        errorCode: 'SMS_NETWORK_ERROR',
        error: '网络异常，短信发送失败',
        statusCode: 502,
      };
    }
  }
}
