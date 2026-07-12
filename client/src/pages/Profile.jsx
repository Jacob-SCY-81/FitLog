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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">邮箱</span>
              <span className="text-gray-200">{profile?.email}</span>
            </div>
            <div className="flex justify-between">
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
