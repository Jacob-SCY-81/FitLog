import { DevConsoleSmsProvider } from './dev-console-sms.provider.js';
import { MockSmsProvider } from './mock-sms.provider.js';
import { AliyunSmsProvider } from './aliyun-sms.provider.js';

let _activeProvider = null;

/**
 * 获取当前激活的 SmsProvider 实例
 * @returns {import('./sms.provider.js').BaseSmsProvider}
 */
export function getSmsProvider() {
  if (_activeProvider) return _activeProvider;

  const mode = process.env.SMS_PROVIDER || (process.env.NODE_ENV === 'test' ? 'mock' : 'console');

  switch (mode) {
    case 'aliyun':
    case 'production':
      _activeProvider = new AliyunSmsProvider();
      break;
    case 'mock':
      _activeProvider = new MockSmsProvider();
      break;
    case 'console':
    default:
      _activeProvider = new DevConsoleSmsProvider();
      break;
  }

  return _activeProvider;
}

/**
 * 显式注入或覆盖 Provider 实例（专供单元测试）
 * @param {import('./sms.provider.js').BaseSmsProvider} provider 
 */
export function setSmsProvider(provider) {
  _activeProvider = provider;
}
