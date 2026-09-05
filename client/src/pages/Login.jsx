import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth);

  // 登录方式：'phone'（默认） | 'email'（次级兼容入口）
  const [method, setMethod] = useState('phone');

  // 手机号登录状态
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneLoggingIn, setPhoneLoggingIn] = useState(false);

  // 邮箱登录状态 (老版本兼容)
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState('email'); // 'email' | 'code'
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailSending, setEmailSending] = useState(false);
  const [emailLoggingIn, setEmailLoggingIn] = useState(false);

  // 通用错误与提示
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);

  const phoneTimerRef = useRef(null);
  const emailTimerRef = useRef(null);

  // 清理计时器
  useEffect(() => {
    return () => {
      if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
      if (emailTimerRef.current) clearInterval(emailTimerRef.current);
    };
  }, []);

  // 错误信息友好映射
  function formatErrorMessage(err, defaultMsg = '操作失败，请稍后再试') {
    const status = err.response?.status;
    const serverMsg = err.response?.data?.message || err.response?.data?.error;

    if (status === 429) {
      if (serverMsg?.includes('锁定') || serverMsg?.includes('locked')) {
        return '登录尝试失败次数过多，账号已临时锁定，请 15 分钟后再试';
      }
      return serverMsg || '请求过于频繁，请稍后再试';
    }
    if (status === 400) {
      if (serverMsg?.includes('手机号') || serverMsg?.includes('phone')) {
        return serverMsg || '请输入有效的11位中国大陆手机号';
      }
      if (serverMsg?.includes('验证码') || serverMsg?.includes('code')) {
        return serverMsg || '验证码错误或已过期，请重新获取';
      }
      return serverMsg || '请求参数有误，请核对后重试';
    }
    if (status === 502 || status === 500) {
      return '短信服务暂不可用，请稍后再试或使用邮箱登录';
    }
    return serverMsg || defaultMsg;
  }

  // --- 手机号登录：发送验证码 ---
  async function handleSendPhoneCode(e) {
    if (e) e.preventDefault();
    if (!phone.trim()) {
      setError('请输入手机号');
      return;
    }
    if (phoneCooldown > 0 || phoneSending) return;

    setError('');
    setNotice('');
    setPhoneSending(true);

    try {
      const { data } = await apiClient.post('/auth/phone/send-code', { phone: phone.trim() });
      const wait = data.data?.cooldownSec || 60;
      setPhoneCooldown(wait);
      setNotice('验证码已发送，请注意查收');

      if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
      phoneTimerRef.current = setInterval(() => {
        setPhoneCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(phoneTimerRef.current);
            phoneTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(formatErrorMessage(err, '发送验证码失败'));
    } finally {
      setPhoneSending(false);
    }
  }

  // --- 手机号登录：提交验证码登录 ---
  async function handlePhoneLogin(e) {
    e.preventDefault();
    if (!phone.trim()) {
      setError('请输入手机号');
      return;
    }
    if (!phoneCode || phoneCode.length !== 6) {
      setError('请输入6位短信验证码');
      return;
    }

    setError('');
    setNotice('');
    setPhoneLoggingIn(true);

    try {
      const { data } = await apiClient.post('/auth/phone/login', {
        phone: phone.trim(),
        code: phoneCode.trim(),
      });
      // 成功登录：保存 user 与 accessToken (RefreshToken 存 HttpOnly Cookie)
      setAuth(data.data.user, data.data.accessToken);
    } catch (err) {
      setError(formatErrorMessage(err, '登录失败，请检查验证码'));
    } finally {
      setPhoneLoggingIn(false);
    }
  }

  // --- 邮箱登录：发送验证码 (老版兼容) ---
  async function handleSendEmailCode(e) {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (emailCooldown > 0 || emailSending) return;

    setError('');
    setEmailSending(true);

    try {
      await apiClient.post('/auth/send-code', { email: email.trim() });
      setEmailStep('code');
      setEmailCooldown(60);

      if (emailTimerRef.current) clearInterval(emailTimerRef.current);
      emailTimerRef.current = setInterval(() => {
        setEmailCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(emailTimerRef.current);
            emailTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(formatErrorMessage(err, '发送邮箱验证码失败'));
    } finally {
      setEmailSending(false);
    }
  }

  // --- 邮箱登录：提交登录 ---
  async function handleEmailLogin(e) {
    e.preventDefault();
    if (!emailCode || emailCode.length !== 6) {
      setError('请输入6位邮箱验证码');
      return;
    }

    setError('');
    setEmailLoggingIn(true);

    try {
      const { data } = await apiClient.post('/auth/login', {
        email: email.trim(),
        code: emailCode.trim(),
      });
      setAuth(data.data.user, data.data.accessToken);
    } catch (err) {
      setError(formatErrorMessage(err, '登录失败'));
    } finally {
      setEmailLoggingIn(false);
    }
  }

  function switchMethod(newMethod) {
    setMethod(newMethod);
    setError('');
    setNotice('');
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-8 bg-gray-950 text-white">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">FitLog</h1>
          <p className="text-sm text-gray-400">专业、极简的健身训练记录工具</p>
        </div>

        {/* Card Container */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-5">
          {/* Method Title */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <span className="font-semibold text-white text-base">
              {method === 'phone' ? '手机号快捷登录' : '邮箱验证码登录'}
            </span>
            <span className="text-xs text-emerald-400/90 font-medium">
              {method === 'phone' ? '自动注册' : '兼容通道'}
            </span>
          </div>

          {/* 状态与提示信息 */}
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs leading-relaxed animate-in fade-in">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs leading-relaxed animate-in fade-in">
              {notice}
            </div>
          )}

          {/* --- 手机号登录表单 (默认) --- */}
          {method === 'phone' && (
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              {/* 手机号输入区 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">中国大陆手机号</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-700 focus-within:border-emerald-500 transition-colors bg-gray-800">
                  <div className="flex items-center px-3.5 bg-gray-800/90 border-r border-gray-700/80 text-gray-300 text-sm font-semibold select-none">
                    +86
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="输入11位手机号"
                    className="w-full h-12 px-3.5 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none"
                  />
                </div>
              </div>

              {/* 验证码输入与获取按钮 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">短信验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6位验证码"
                    className="flex-1 h-12 px-3.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500
                               text-base tracking-widest focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSendPhoneCode}
                    disabled={phoneCooldown > 0 || phoneSending}
                    className="h-12 px-4 bg-gray-800 hover:bg-gray-700/80 disabled:opacity-50 text-emerald-400 text-xs font-semibold
                               border border-gray-700 rounded-xl whitespace-nowrap transition-colors select-none min-w-[104px]"
                  >
                    {phoneSending
                      ? '发送中...'
                      : phoneCooldown > 0
                      ? `${phoneCooldown}s 后重试`
                      : '获取验证码'}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-normal">
                未注册手机号验证后将自动创建账号
              </p>

              {/* 主操作按钮 */}
              <button
                type="submit"
                disabled={phoneLoggingIn || !phoneCode || phoneCode.length !== 6}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                           rounded-xl font-bold text-sm text-white tracking-wide transition-all shadow-md active:scale-[0.99]"
              >
                {phoneLoggingIn ? '登录验证中...' : '登录 / 注册'}
              </button>
            </form>
          )}

          {/* --- 邮箱登录表单 (老版本次级入口) --- */}
          {method === 'email' && (
            <div className="space-y-4">
              {emailStep === 'email' ? (
                <form onSubmit={handleSendEmailCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">邮箱地址</label>
                    <input
                      type="text"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com 或 admin@admin"
                      className="w-full h-12 px-3.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500
                                 text-sm focus:border-emerald-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={emailSending}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                               rounded-xl font-bold text-sm text-white transition-all shadow-md"
                  >
                    {emailSending ? '发送中...' : '发送邮箱验证码'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      验证码已发往 <span className="text-gray-200">{email}</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full h-12 px-3.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-center text-xl tracking-widest
                                 placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-colors"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={emailLoggingIn || emailCode.length !== 6}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                               rounded-xl font-bold text-sm text-white transition-all shadow-md"
                  >
                    {emailLoggingIn ? '验证中...' : '登录'}
                  </button>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => { setEmailStep('email'); setError(''); }}
                      className="text-gray-400 hover:text-gray-200 py-1"
                    >
                      更换邮箱
                    </button>
                    <button
                      type="button"
                      onClick={handleSendEmailCode}
                      disabled={emailCooldown > 0 || emailSending}
                      className="text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 py-1"
                    >
                      {emailCooldown > 0 ? `重新发送 (${emailCooldown}s)` : '重新发送'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 登录方式切换入口 */}
          <div className="pt-2 text-center">
            {method === 'phone' ? (
              <button
                type="button"
                onClick={() => switchMethod('email')}
                className="text-xs text-gray-400 hover:text-emerald-400 transition-colors py-2 px-3 rounded-lg hover:bg-gray-800/40"
              >
                使用旧版邮箱登录 →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMethod('phone')}
                className="text-xs text-gray-400 hover:text-emerald-400 transition-colors py-2 px-3 rounded-lg hover:bg-gray-800/40"
              >
                ← 返回手机号快捷登录
              </button>
            )}
          </div>
        </div>

        {/* 隐私与协议合规声明 */}
        <div className="text-center space-y-2 text-[11px] text-gray-500 px-4 leading-relaxed">
          <p>
            登录或注册即表示您已阅读并同意{' '}
            <button
              type="button"
              onClick={() => setShowAgreement(true)}
              className="text-emerald-400 hover:underline inline"
            >
              《用户协议》
            </button>{' '}
            与{' '}
            <button
              type="button"
              onClick={() => setShowAgreement(true)}
              className="text-emerald-400 hover:underline inline"
            >
              《隐私政策》
            </button>
          </p>
          <p className="text-gray-600">
            手机号仅用于账号登录与核心安全验证，FitLog 严格承诺不采集多余设备权限
          </p>
        </div>
      </div>

      {/* 极简协议弹窗 */}
      {showAgreement && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">用户协议与隐私保护声明</h3>
            <div className="text-xs text-gray-300 space-y-2 max-h-60 overflow-y-auto leading-relaxed pr-1">
              <p>1. <strong>服务说明</strong>：FitLog 为个人健身训练记录应用，向您提供动作库、训练打卡、数据统计等功能。</p>
              <p>2. <strong>信息收集最小化</strong>：本应用仅收集用于鉴权与安全登录的手机号码或邮箱，绝不向第三方机构共享您的个人数据。</p>
              <p>3. <strong>敏感权限承诺</strong>：我们不调用相机外设、GPS 定位、麦克风、通讯录或身份证信息。</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAgreement(false)}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              我已知晓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
