import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const updateUser = useAuthStore(s => s.updateUser);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 手机号绑定状态
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindPhoneInput, setBindPhoneInput] = useState('');
  const [bindCodeInput, setBindCodeInput] = useState('');
  const [bindCooldown, setBindCooldown] = useState(0);
  const [bindSending, setBindSending] = useState(false);
  const [bindSubmitting, setBindSubmitting] = useState(false);
  const [bindError, setBindError] = useState('');
  const [bindSuccess, setBindSuccess] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient.get('/user/profile')
      .then(({ data }) => {
        setProfile(data.data);
        setNickname(data.data.nickname || '');
      })
      .catch((err) => setError(err.response?.data?.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  // 发送绑定验证码
  async function handleSendBindCode() {
    if (!bindPhoneInput.trim()) {
      setBindError('请输入手机号');
      return;
    }
    setBindError('');
    setBindSending(true);

    try {
      const { data } = await apiClient.post('/auth/phone/send-code', { phone: bindPhoneInput.trim() });
      const wait = data.data?.cooldownSec || 60;
      setBindCooldown(wait);
      const timer = setInterval(() => {
        setBindCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setBindError(err.response?.data?.message || err.response?.data?.error || '发送验证码失败');
    } finally {
      setBindSending(false);
    }
  }

  // 提交绑定手机号
  async function handleSubmitBindPhone(e) {
    e.preventDefault();
    if (!bindPhoneInput.trim()) {
      setBindError('请输入手机号');
      return;
    }
    if (!bindCodeInput.trim() || bindCodeInput.trim().length !== 6) {
      setBindError('请输入6位短信验证码');
      return;
    }

    setBindError('');
    setBindSubmitting(true);

    try {
      const { data } = await apiClient.post('/user/bind-phone', {
        phone: bindPhoneInput.trim(),
        code: bindCodeInput.trim(),
      });
      const updatedUser = data.data?.user;
      setProfile((prev) => ({
        ...prev,
        phone: updatedUser?.phone || bindPhoneInput.trim(),
        phoneVerifiedAt: updatedUser?.phoneVerifiedAt || new Date().toISOString(),
      }));
      updateUser({ phone: updatedUser?.phone || bindPhoneInput.trim() });
      setBindSuccess('手机号绑定成功！');
      setTimeout(() => {
        setShowBindModal(false);
        setBindSuccess('');
        setBindPhoneInput('');
        setBindCodeInput('');
      }, 1200);
    } catch (err) {
      const status = err.response?.status;
      const errorCode = err.response?.data?.error;
      if (status === 409 || errorCode === 'PHONE_ALREADY_BOUND') {
        setBindError('该手机号已绑定其他账号，请使用其他手机号。');
      } else {
        setBindError(err.response?.data?.message || '绑定失败，请检查验证码');
      }
    } finally {
      setBindSubmitting(false);
    }
  }

  function maskPhone(p) {
    if (!p) return '--';
    const digits = p.replace(/^\+86/, '');
    if (digits.length === 11) {
      return `+86 ${digits.slice(0, 3)}****${digits.slice(7)}`;
    }
    return p;
  }

  async function handleSaveProfile() {
    setSaving(true);
    setSaveError('');
    try {
      const { data } = await apiClient.put('/user/profile', {
        nickname: nickname.trim() || null,
        avatarUrl: null,
      });
      setProfile(prev => ({ ...prev, nickname: data.data.nickname }));
      setEditing(false);
    } catch (err) {
      setSaveError(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    navigate('/login');
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="min-h-dvh pb-16 max-w-4xl mx-auto lg:max-w-6xl">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-bold">个人资料</h1>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Avatar & Name */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
          <div className="w-20 h-20 mx-auto bg-emerald-900/30 rounded-full flex items-center justify-center
                          border-2 border-emerald-600/30 mb-3">
            <span className="text-3xl font-bold text-emerald-400">
              {(profile?.nickname || profile?.email || 'U')[0].toUpperCase()}
            </span>
          </div>

          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入昵称"
                maxLength={50}
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-center text-sm
                           border border-gray-700 focus:border-emerald-500 focus:outline-none"
                autoFocus
              />
              {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => { setEditing(false); setNickname(profile?.nickname || ''); }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-sm font-medium"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-white">
                {profile?.nickname || '未设置昵称'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">{profile?.email}</p>
              <button
                onClick={() => setEditing(true)}
                className="mt-3 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors"
              >
                编辑资料
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">训练统计</h3>
          <div className="grid grid-cols-3 gap-3">
            <StatItem value={profile?.stats?.totalWorkouts || 0} label="总训练次数" />
            <StatItem value={profile?.stats?.totalFavorites || 0} label="收藏动作" />
            <StatItem value={profile?.stats?.totalCustomExercises || 0} label="自定义动作" />
          </div>
        </div>

        {/* Account info */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">账户信息</h3>
          <div className="space-y-3 text-sm">
            {/* 手机号 (Phase 2.3) */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">手机号码</span>
              {profile?.phone ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-200 font-medium">{maskPhone(profile.phone)}</span>
                  <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[11px] rounded-full">
                    已绑定
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">未绑定</span>
                  <button
                    type="button"
                    onClick={() => { setShowBindModal(true); setBindError(''); setBindSuccess(''); }}
                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    绑定手机号
                  </button>
                </div>
              )}
            </div>

            {/* 邮箱 */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">邮箱</span>
              <span className="text-gray-200">{profile?.email || '未绑定'}</span>
            </div>

            {/* 注册时间 */}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">注册时间</span>
              <span className="text-gray-200">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('zh-CN') : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <NavRow icon="📅" label="训练日历" onClick={() => navigate('/calendar')} />
          <NavRow icon="📋" label="训练模板" onClick={() => navigate('/templates')} />
          <NavRow icon="📏" label="身体数据" onClick={() => navigate('/measurements')} />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-900/30 hover:bg-red-900/50 border border-red-800/30
                     rounded-lg text-sm text-red-300 font-medium transition-colors"
          style={{ minHeight: '44px' }}
        >
          退出登录
        </button>
      </div>

      {/* 手机号绑定弹窗 (Phase 2.3) */}
      {showBindModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">绑定中国大陆手机号</h3>
              <button
                type="button"
                onClick={() => setShowBindModal(false)}
                className="text-gray-500 hover:text-gray-300 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              绑定手机号后，您可直接使用手机号及短信验证码快捷登录，原有训练数据与账号历史将完整保留。
            </p>

            {bindError && (
              <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs">
                {bindError}
              </div>
            )}
            {bindSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs">
                {bindSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitBindPhone} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">手机号码</label>
                <div className="flex rounded-xl overflow-hidden border border-gray-700 focus-within:border-emerald-500 transition-colors bg-gray-800">
                  <div className="flex items-center px-3 bg-gray-800/90 border-r border-gray-700/80 text-gray-300 text-sm font-semibold select-none">
                    +86
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={bindPhoneInput}
                    onChange={(e) => setBindPhoneInput(e.target.value)}
                    placeholder="11位手机号"
                    className="w-full h-11 px-3 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={bindCodeInput}
                    onChange={(e) => setBindCodeInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="6位验证码"
                    className="flex-1 h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm tracking-widest focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendBindCode}
                    disabled={bindCooldown > 0 || bindSending}
                    className="h-11 px-3.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 text-xs font-semibold border border-gray-700 rounded-xl whitespace-nowrap disabled:opacity-50 min-w-[96px]"
                  >
                    {bindSending ? '发送中...' : bindCooldown > 0 ? `${bindCooldown}s` : '获取验证码'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBindModal(false)}
                  className="flex-1 h-11 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={bindSubmitting || !bindCodeInput || bindCodeInput.length !== 6}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {bindSubmitting ? '绑定中...' : '确认绑定'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-emerald-400">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function NavRow({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors
                 border-b border-gray-800 last:border-0 text-left"
      style={{ minHeight: '48px' }}
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-sm text-white">{label}</span>
      <span className="text-gray-600">→</span>
    </button>
  );
}
