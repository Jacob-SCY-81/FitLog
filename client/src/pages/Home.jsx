import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { useWorkoutStore, loadDraft } from '../stores/workoutStore.js';
import apiClient from '../api/client.js';

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const store = useWorkoutStore();
  const [exporting, setExporting] = useState(null);
  const [draft, setDraft] = useState(null);

  // AC-03.4: Check for draft on Home page mount
  useEffect(() => {
    if (user?.id) {
      const existing = loadDraft(user.id);
      if (existing && existing.exercises?.length > 0) {
        setDraft(existing);
      }
    }
  }, [user?.id]);

  function handleRecoverDraft() {
    store.initDraft(user.id);
    setDraft(null);
    navigate('/workouts/new');
  }

  function handleDiscardDraft() {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${user.id}`);
    setDraft(null);
  }

  async function handleLogout() {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    navigate('/login');
  }

  async function handleExport(format) {
    setExporting(format);
    try {
      const res = await apiClient.get('/export', {
        params: { format },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitlog-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || '导出失败（每日最多 3 次）');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="min-h-dvh pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="px-4 py-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">FitLog</h1>
            <p className="text-sm text-gray-400 mt-1">欢迎, {user?.email}</p>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-emerald-900/30 border border-emerald-600/30
                       flex items-center justify-center text-emerald-400 font-bold hover:bg-emerald-900/50"
            style={{ minWidth: '44px', minHeight: '44px' }}
            title="个人资料"
          >
            {(user?.email || 'U')[0].toUpperCase()}
          </button>
        </div>
      </div>

      {/* AC-03.4: Draft recovery banner */}
      {draft && (
        <div className="mx-4 mt-4 bg-amber-900/30 border border-amber-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-200">检测到未完成的训练草稿</p>
              <p className="text-xs text-amber-400/70 mt-1">
                上次编辑：{new Date(draft.updatedAt).toLocaleString('zh-CN')}
                · {draft.exercises?.length || 0} 个动作
              </p>
              {/* AC-03.5: Conflict warning if draft is older than 6 hours */}
              {Date.now() - draft.updatedAt > 6 * 60 * 60 * 1000 && (
                <p className="text-xs text-red-400 mt-1">
                  此草稿可能与已保存的训练记录冲突，请确认后恢复
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRecoverDraft}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors"
              style={{ minHeight: '44px' }}
            >
              恢复草稿
            </button>
            <button
              onClick={handleDiscardDraft}
              className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              style={{ minHeight: '44px' }}
            >
              放弃
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">快速开始</h2>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => navigate('/workouts/new')}
            className="bg-emerald-600/10 border border-emerald-600/30 rounded-xl p-4
                       hover:bg-emerald-600/20 transition-colors text-left"
            style={{ minHeight: '88px' }}
          >
            <div className="text-2xl mb-1">🏋️</div>
            <p className="font-bold text-white text-sm">开始训练</p>
            <p className="text-xs text-gray-400 mt-0.5">记录今天的训练</p>
          </button>
          <button
            onClick={() => navigate('/exercises')}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4
                       hover:border-gray-700 transition-colors text-left"
            style={{ minHeight: '88px' }}
          >
            <div className="text-2xl mb-1">📚</div>
            <p className="font-bold text-white text-sm">动作库</p>
            <p className="text-xs text-gray-400 mt-0.5">873 个动作</p>
          </button>
          <button
            onClick={() => navigate('/workouts')}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4
                       hover:border-gray-700 transition-colors text-left"
            style={{ minHeight: '88px' }}
          >
            <div className="text-2xl mb-1">📋</div>
            <p className="font-bold text-white text-sm">训练历史</p>
            <p className="text-xs text-gray-400 mt-0.5">查看过往记录</p>
          </button>
          <button
            onClick={() => navigate('/stats')}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4
                       hover:border-gray-700 transition-colors text-left"
            style={{ minHeight: '88px' }}
          >
            <div className="text-2xl mb-1">📊</div>
            <p className="font-bold text-white text-sm">数据统计</p>
            <p className="text-xs text-gray-400 mt-0.5">力量增长分析</p>
          </button>
          <button
            onClick={() => navigate('/calendar')}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4
                       hover:border-gray-700 transition-colors text-left"
            style={{ minHeight: '88px' }}
          >
            <div className="text-2xl mb-1">📅</div>
            <p className="font-bold text-white text-sm">训练日历</p>
            <p className="text-xs text-gray-400 mt-0.5">训练频率可视化</p>
          </button>
          <button
            onClick={() => navigate('/templates')}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4
                       hover:border-gray-700 transition-colors text-left"
            style={{ minHeight: '88px' }}
          >
            <div className="text-2xl mb-1">📋</div>
            <p className="font-bold text-white text-sm">训练模板</p>
            <p className="text-xs text-gray-400 mt-0.5">快速加载训练计划</p>
          </button>
        </div>
      </div>

      {/* Data Export */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">数据管理</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-sm text-gray-300 mb-3">导出全部训练数据</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('json')}
              disabled={exporting === 'json'}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-center transition-colors disabled:opacity-50"
              style={{ minHeight: '44px' }}
            >
              {exporting === 'json' ? '导出中...' : '📄 JSON'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting === 'csv'}
              className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-center transition-colors disabled:opacity-50"
              style={{ minHeight: '44px' }}
            >
              {exporting === 'csv' ? '导出中...' : '📊 CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
