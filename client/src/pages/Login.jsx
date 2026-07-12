import { useState } from 'react';
import apiClient from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  async function handleSendCode(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/send-code', { email });
      setStep('code');
      // 60s cooldown before resending
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, code });
      setAuth(data.data.user, data.data.accessToken);
    } catch (err) {
      setError(err.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-emerald-400">FitLog</h1>
          <p className="mt-2 text-sm text-gray-400">健身训练记录</p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 rounded-xl p-6 space-y-4">
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">邮箱</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white placeholder-gray-500
                             border border-gray-700 focus:border-emerald-500 focus:outline-none"
                  autoComplete="email"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                           rounded-lg font-semibold transition-colors"
              >
                {loading ? '发送中...' : '发送验证码'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  验证码 — 已发送至 <span className="text-gray-200">{email}</span>
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white text-center text-2xl tracking-widest
                             placeholder-gray-500 border border-gray-700 focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                           rounded-lg font-semibold transition-colors"
              >
                {loading ? '验证中...' : '登录'}
              </button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="text-gray-400 hover:text-gray-200"
                >
                  更换邮箱
                </button>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={cooldown > 0 || loading}
                  className="text-emerald-400 hover:text-emerald-300 disabled:text-gray-600"
                >
                  {cooldown > 0 ? `重新发送 (${cooldown}s)` : '重新发送'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
