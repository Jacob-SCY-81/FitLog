import { DevConsoleEmailProvider } from './dev-console-email.provider.js';
import { MockEmailProvider } from './mock-email.provider.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';

let _activeEmailProvider = null;

/**
 * 获取当前全局生效的 EmailProvider 实例
 * @returns {import('./email.provider.js').BaseEmailProvider}
 */
export function getEmailProvider() {
  if (_activeEmailProvider) return _activeEmailProvider;

  const mode =
    process.env.EMAIL_PROVIDER ||
    (process.env.EMAIL_MODE === 'production' ? 'smtp' : (process.env.NODE_ENV === 'test' ? 'mock' : 'console'));

  switch (mode) {
    case 'smtp':
    case 'production':
      _activeEmailProvider = new SmtpEmailProvider();
      break;
    case 'mock':
      _activeEmailProvider = new MockEmailProvider();
      break;
    case 'console':
    default:
      _activeEmailProvider = new DevConsoleEmailProvider();
      break;
  }

  return _activeEmailProvider;
}

/**
 * 显式注入或替换 EmailProvider 实例（专供测试）
 * @param {import('./email.provider.js').BaseEmailProvider | null} provider 
 */
export function setEmailProvider(provider) {
  _activeEmailProvider = provider;
}
