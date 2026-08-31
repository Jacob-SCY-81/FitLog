import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client.js';
import { MUSCLE_LABELS } from '../constants/muscles.js';
import { EQUIPMENT_LABELS } from '../constants/equipment.js';
import { tExerciseName } from '../utils/i18n.js';
import ExerciseAnimation from '../components/ExerciseAnimation.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

export default function ExerciseList() {
  const [exercises, setExercises] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [options, setOptions] = useState({ muscles: [], equipment: [] });
  const [showCreate, setShowCreate] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [showFavorites, setShowFavorites] = useState(false);
  const limit = 20;

  const fetchExercises = useCallback(async () => {
    if (showFavorites) return;
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (muscle) params.muscle = muscle;
      if (equipment) params.equipment = equipment;
      const { data } = await apiClient.get('/exercises', { params });
      setExercises(data.data.data);
      setTotal(data.data.total);
    } catch (err) {
      console.error('Failed to fetch exercises:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, muscle, equipment, showFavorites]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    apiClient.get('/exercises/options').then(({ data }) => {
      setOptions(data.data);
    }).catch(() => {});
    // Load favorite IDs
    apiClient.get('/favorites/ids').then(({ data }) => {
      setFavoriteIds(new Set(data.data || []));
    }).catch(() => {});
  }, []);

  // Fetch favorites list
  useEffect(() => {
    if (!showFavorites) return;
    setLoading(true);
    apiClient.get('/favorites')
      .then(({ data }) => {
        setExercises(data.data || []);
        setTotal((data.data || []).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [showFavorites]);

  async function toggleFavorite(exerciseId) {
    const isFav = favoriteIds.has(exerciseId);
    try {
      if (isFav) {
        await apiClient.delete(`/favorites/${exerciseId}`);
        setFavoriteIds(prev => { const next = new Set(prev); next.delete(exerciseId); return next; });
      } else {
        await apiClient.post(`/favorites/${exerciseId}`);
        setFavoriteIds(prev => new Set([...prev, exerciseId]));
      }
    } catch {
      // silently ignore
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-dvh pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">动作库</h1>
            <p className="text-xs text-gray-400">{total} 个动作</p>
          </div>
          <button
            onClick={() => { setShowFavorites(!showFavorites); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${showFavorites ? 'bg-red-900/30 text-red-300 border border-red-700/30' : 'bg-gray-800 text-gray-400'}`}
            style={{ minHeight: '44px' }}
          >
            {showFavorites ? '❤️ 收藏中' : '♡ 收藏'}
          </button>
        </div>
      </div>

      {/* Search & Filters — hidden in favorites mode */}
      {!showFavorites && (
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索动作名称..."
            className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-white text-sm
                       border border-gray-700 focus:border-emerald-500 focus:outline-none
                       placeholder-gray-500"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            + 自定义
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          <select
            value={muscle}
            onChange={(e) => { setMuscle(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-gray-800 rounded-lg text-white text-sm border border-gray-700 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">全部肌群</option>
            {options.muscles.map(m => (
              <option key={m} value={m}>{MUSCLE_LABELS[m] || m}</option>
            ))}
          </select>
          <select
            value={equipment}
            onChange={(e) => { setEquipment(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-gray-800 rounded-lg text-white text-sm border border-gray-700 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">全部器械</option>
            {options.equipment.map(e => (
              <option key={e} value={e}>{EQUIPMENT_LABELS[e] || e}</option>
            ))}
          </select>
        </div>
      </div>
      )}

      {/* Exercise Grid */}
      <div className="px-4">
        {loading ? (
          <LoadingSpinner />
        ) : exercises.length === 0 ? (
          <div className="text-center py-12 text-gray-400">没有找到动作</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {exercises.map(ex => (
              <Link
                key={ex.id}
                to={`/exercises/${ex.id}`}
                className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800
                           hover:border-emerald-600 transition-colors active:scale-[0.98]"
                style={{ minHeight: '44px' }}
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-gray-800 relative">
                  {ex.mediaUrl ? (
                    <img
                      src={ex.mediaUrl}
                      alt={ex.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {!ex.isOfficial && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600/80 rounded text-[10px]">
                      自定义
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">
                        {ex.isOfficial ? tExerciseName(ex.id, ex.name) : ex.name}

                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {MUSCLE_LABELS[ex.targetMuscle] || ex.targetMuscle}
                        {ex.equipment && ` · ${EQUIPMENT_LABELS[ex.equipment] || ex.equipment}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(ex.id); }}
                      className={`p-1.5 flex-shrink-0 ml-1 rounded ${favoriteIds.has(ex.id) ? 'text-red-400' : 'text-gray-600 hover:text-red-300'}`}
                      style={{ minWidth: '44px', minHeight: '44px' }}
                      title={favoriteIds.has(ex.id) ? '取消收藏' : '收藏'}
                    >
                      {favoriteIds.has(ex.id) ? '❤️' : '🤍'}
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination — hidden in favorites mode */}
        {!showFavorites && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 bg-gray-800 rounded-lg text-sm disabled:opacity-30 hover:bg-gray-700"
            >
              上一页
            </button>
            <span className="text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 bg-gray-800 rounded-lg text-sm disabled:opacity-30 hover:bg-gray-700"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* Create Exercise Modal */}
      {showCreate && (
        <CreateExerciseModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchExercises(); }}
        />
      )}
    </div>
  );
}

function CreateExerciseModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/exercises', {
        name,
        targetMuscle,
        equipment: equipment || null,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 space-y-4
                      animate-[slideUp_0.2s_ease-out]">
        <h2 className="text-lg font-bold">新建自定义动作</h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">动作名称 *</label>
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
              placeholder="如：弹力带侧平举"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">目标肌群 *</label>
            <select
              required value={targetMuscle} onChange={(e) => setTargetMuscle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
            >
              <option value="">选择肌群</option>
              {Object.entries(MUSCLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v} ({k})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">器械类型</label>
            <input
              type="text" value={equipment} onChange={(e) => setEquipment(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
              placeholder="如：弹力带、哑铃、自重"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
              取消
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
