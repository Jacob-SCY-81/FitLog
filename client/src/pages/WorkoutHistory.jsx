import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import { formatTime } from '../utils/format.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function WorkoutHistory() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 20;

  const fetchWorkouts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/workouts', { params: { page, limit } });
      setWorkouts(data.data.data);
      setTotal(data.data.total);
    } catch (err) {
      setError(err.response?.data?.message || '加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchWorkouts(); }, [fetchWorkouts]);

  function formatDateShort(d) {
    return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
  }

  function calcDuration(start, end) {
    if (!end) return '--';
    const mins = Math.round((new Date(end) - new Date(start)) / 60000);
    if (mins < 60) return `${mins}分钟`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-dvh pb-16 max-w-4xl mx-auto lg:max-w-6xl">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800
                      flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">训练历史</h1>
          <p className="text-xs text-gray-400">{total} 次训练</p>
        </div>
        <button
          onClick={() => navigate('/workouts/new')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold"
          style={{ minHeight: '44px' }}
        >
          开始训练
        </button>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {error ? (
          <ErrorMessage message={error} onRetry={fetchWorkouts} />
        ) : loading ? (
          <LoadingSpinner />
        ) : workouts.length === 0 ? (
          <EmptyState
            icon="🏋️"
            title="还没有训练记录"
            description="开始你的第一次训练，记录你的进步！"
            actionLabel="开始训练"
            actionTo="/workouts/new"
          />
        ) : (
          workouts.map(w => (
            <Link
              key={w.id}
              to={`/workouts/${w.id}`}
              className="block bg-gray-900 rounded-xl p-4 border border-gray-800
                         hover:border-emerald-600 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{formatDateShort(w.startTime)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatTime(w.startTime)} · {calcDuration(w.startTime, w.endTime)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold">
                    {w.totalVolumeKg?.toLocaleString()} kg
                  </p>
                  <p className="text-xs text-gray-500">{w._count.exerciseSets} 组</p>
                </div>
              </div>
              {w.notes && (
                <p className="text-xs text-gray-500 mt-2 truncate">{w.notes}</p>
              )}
            </Link>
          ))
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 bg-gray-800 rounded-lg text-sm disabled:opacity-30">
              上一页
            </button>
            <span className="text-sm text-gray-400">{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 bg-gray-800 rounded-lg text-sm disabled:opacity-30">
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
