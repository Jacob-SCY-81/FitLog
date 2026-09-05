import { useState, useRef, useEffect } from 'react';
import apiClient from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';

// 内联 Eye 图标
function EyeIcon({ className = 'w-5 h-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

// 内联 EyeOff 图标
function EyeOffIcon({ className = 'w-5 h-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth);

  // 模式：'login' (手机号+密码登录) | 'register' (手机号+密码注册) | 'email' (老版本邮箱兼容)
  const [mode, setMode] = useState('login');

  // 表单输入
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 邮箱模式状态
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState('email');
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailSending, setEmailSending] = useState(false);
  const emailTimerRef = useRef(null);

  // 交互状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);

  useEffect(() => {
    return () => {
      if (emailTimerRef.current) clearInterval(emailTimerRef.current);
    };
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  }

  function formatErrorMessage(err, defaultMsg = '操作失败，请稍后再试') {
    const status = err.response?.status;
    const data = err.response?.data;
    const serverMsg = data?.message || data?.error;

    if (status === 429) {
      return serverMsg || '登录尝试失败次数过多，账号已临时锁定，请 15 分钟后再试';
    }
    if (status === 401) {
      return serverMsg || '手机号或密码错误';
    }
    if (status === 409) {
      return serverMsg || '该手机号已注册，请直接登录';
    }
    if (status === 400) {
      return serverMsg || '请求参数格式有误，请检查后重试';
    }
    return serverMsg || defaultMsg;
  }

  // --- 手机号 + 密码登录 ---
  async function handlePhonePasswordLogin(e) {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError('请输入手机号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setError('');
    setNotice('');
    setLoading(true);

    try {
      const { data } = await apiClient.post('/auth/phone-password/login', {
        phone: cleanPhone,
        password,
      });
      setAuth(data.data.user, data.data.accessToken);
    } catch (err) {
      setError(formatErrorMessage(err, '登录失败，请检查手机号或密码'));
    } finally {
      setLoading(false);
    }
  }

  // --- 手机号 + 密码注册 ---
  async function handlePhonePasswordRegister(e) {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError('请输入手机号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (password.length < 8) {
      setError('密码长度至少为 8 位');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('密码必须同时包含字母和数字');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setError('');
    setNotice('');
    setLoading(true);

    try {
      const { data } = await apiClient.post('/auth/register', {
        phone: cleanPhone,
        password,
        confirmPassword,
      });
      setAuth(data.data.user, data.data.accessToken);
    } catch (err) {
      setError(formatErrorMessage(err, '注册失败，请检查填写信息'));
    } finally {
      setLoading(false);
    }
  }

  // --- 兼容通道：邮箱验证码 ---
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

  async function handleEmailLogin(e) {
    e.preventDefault();
    if (!emailCode || emailCode.length !== 6) {
      setError('请输入6位邮箱验证码');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { data } = await apiClient.post('/auth/login', {
        email: email.trim(),
        code: emailCode.trim(),
      });
      setAuth(data.data.user, data.data.accessToken);
    } catch (err) {
      setError(formatErrorMessage(err, '登录失败'));
    } finally {
      setLoading(false);
    }
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
          {/* Header Title */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <span className="font-semibold text-white text-base">
              {mode === 'login' && '手机号密码登录'}
              {mode === 'register' && '注册新账号'}
              {mode === 'email' && '邮箱验证码登录'}
            </span>
            <span className="text-xs text-emerald-400/90 font-medium">
              {mode === 'email' ? '备用通道' : '安全认证'}
            </span>
          </div>

          {/* 错误提示 */}
          {error && (
            <div data-testid="auth-error-message" className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs leading-relaxed animate-in fade-in">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs leading-relaxed animate-in fade-in">
              {notice}
            </div>
          )}

          {/* --- 模式 1：手机号 + 密码登录 --- */}
          {mode === 'login' && (
            <form onSubmit={handlePhonePasswordLogin} className="space-y-4">
              {/* 手机号 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">手机号码</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-700 focus-within:border-emerald-500 transition-colors bg-gray-800 h-12">
                  <div className="flex items-center px-3.5 bg-gray-800/90 border-r border-gray-700/80 text-gray-300 text-sm font-semibold select-none">
                    +86
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="输入11位手机号"
                    className="w-full h-full px-3.5 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">登录密码</label>
                <div className="relative flex rounded-xl overflow-hidden border border-gray-700 focus-within:border-emerald-500 transition-colors bg-gray-800 h-12">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入登录密码"
                    className="w-full h-full pl-3.5 pr-11 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 bottom-0 px-3.5 flex items-center text-gray-400 hover:text-gray-200 transition-colors select-none"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                           rounded-xl font-bold text-sm text-white tracking-wide transition-all shadow-md active:scale-[0.99]"
              >
                {loading ? '登录中...' : '登录'}
              </button>

              {/* 导航操作 */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-emerald-400 hover:text-emerald-300 py-1 transition-colors font-medium"
                >
                  注册新账号
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('email')}
                  className="text-gray-400 hover:text-gray-200 py-1 transition-colors"
                >
                  使用旧版邮箱登录 →
                </button>
              </div>
            </form>
          )}

          {/* --- 模式 2：手机号 + 密码注册 --- */}
          {mode === 'register' && (
            <form onSubmit={handlePhonePasswordRegister} className="space-y-4">
              {/* 手机号 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">手机号码</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-700 focus-within:border-emerald-500 transition-colors bg-gray-800 h-12">
                  <div className="flex items-center px-3.5 bg-gray-800/90 border-r border-gray-700/80 text-gray-300 text-sm font-semibold select-none">
                    +86
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="输入11位手机号"
                    className="w-full h-full px-3.5 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  设置密码 <span className="text-[11px] text-gray-500">(至少8位，含字母与数字)</span>
                </label>
                <div className="relative flex rounded-xl overflow-hidden border border-gray-700 focus-within:border-emerald-500 transition-colors bg-gray-800 h-12">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入8位以上组合密码"
                    className="w-full h-full pl-3.5 pr-11 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 bottom-0 px-3.5 flex items-center text-gray-400 hover:text-gray-200 transition-colors select-none"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 确认密码 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">确认密码</label>
                <div className="relative flex rounded-xl overflow-hidden border border-gray-700 focus-within:border-emerald-500 transition-colors bg-gray-800 h-12">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入确认密码"
                    className="w-full h-full pl-3.5 pr-11 bg-transparent text-white placeholder-gray-500 text-base focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-0 bottom-0 px-3.5 flex items-center text-gray-400 hover:text-gray-200 transition-colors select-none"
                    aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                  >
                    {showConfirmPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 注册按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                           rounded-xl font-bold text-sm text-white tracking-wide transition-all shadow-md active:scale-[0.99]"
              >
                {loading ? '注册中...' : '注册'}
              </button>

              {/* 返回登录 */}
              <div className="text-center text-xs pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-gray-400 hover:text-emerald-400 py-1 transition-colors"
                >
                  已有账号？直接登录
                </button>
              </div>
            </form>
          )}

          {/* --- 模式 3：老版本邮箱兼容入口 --- */}
          {mode === 'email' && (
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
                    disabled={loading || emailCode.length !== 6}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                               rounded-xl font-bold text-sm text-white transition-all shadow-md"
                  >
                    {loading ? '验证中...' : '登录'}
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

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-gray-400 hover:text-emerald-400 transition-colors py-2 px-3 rounded-lg hover:bg-gray-800/40"
                >
                  ← 返回手机号密码登录
                </button>
              </div>
            </div>
          )}
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
            FitLog 严格承诺保护用户账号安全，绝不收集与健身打卡无关的多余设备权限
          </p>
        </div>
      </div>

      {/* 协议弹窗 */}
      {showAgreement && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">用户协议与隐私保护声明</h3>
            <div className="text-xs text-gray-300 space-y-2 max-h-60 overflow-y-auto leading-relaxed pr-1">
              <p>1. <strong>服务说明</strong>：FitLog 为个人健身训练记录应用，向您提供动作库、训练打卡、数据统计等功能。</p>
              <p>2. <strong>信息安全保护</strong>：本应用仅收集用于鉴权与安全登录的手机号码或邮箱，绝不向第三方机构共享您的个人数据。</p>
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
