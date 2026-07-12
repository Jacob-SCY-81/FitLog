import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function CalendarView() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    setLoading(true);
    setError('');
    // Fetch all workouts (up to 200) for calendar rendering
    apiClient.get('/workouts', { params: { page: 1, limit: 50 } })
      .then(({ data }) => setWorkouts(data.data.data || []))
      .catch((err) => setError(err.response?.data?.message || '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Workout dates map for quick lookup
  const workoutMap = new Map();
  workouts.forEach(w => {
    const d = new Date(w.startTime).toISOString().split('T')[0];
    if (!workoutMap.has(d)) workoutMap.set(d, []);
    workoutMap.get(d).push(w);
  });

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayWorkouts = workoutMap.get(dateStr) || [];
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    days.push({ day: d, dateStr, workouts: dayWorkouts, isToday });
  }

  function goToMonth(delta) {
    setViewDate(new Date(year, month + delta, 1));
  }

  const monthLabel = `${year}年 ${month + 1}月`;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // Group workouts by month for the summary below
  const monthlyWorkouts = workouts.filter(w => {
    const d = new Date(w.startTime);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const monthlyVolume = monthlyWorkouts.reduce((sum, w) => sum + (w.totalVolumeKg || 0), 0);
  const monthlyCount = monthlyWorkouts.length;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="min-h-dvh pb-16 max-w-4xl mx-auto lg:max-w-6xl">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">训练日历</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => goToMonth(-1)} className="p-2 text-gray-400 hover:text-white"
              style={{ minWidth: '44px', minHeight: '44px' }}>◀</button>
            <span className="text-sm font-medium min-w-[80px] text-center">{monthLabel}</span>
            <button onClick={() => goToMonth(1)} className="p-2 text-gray-400 hover:text-white"
              style={{ minWidth: '44px', minHeight: '44px' }}>▶</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-2xl font-bold text-emerald-400">{monthlyCount}</p>
          <p className="text-xs text-gray-500 mt-1">本月训练次数</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-2xl font-bold text-emerald-400">{(monthlyVolume / 1000).toFixed(1)}k</p>
          <p className="text-xs text-gray-500 mt-1">本月总训练量 (kg)</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-2 mt-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ day, dateStr, workouts: dayWorkouts, isToday }) => {
            if (!day) return <div key={dateStr || `empty-${Math.random()}`} className="aspect-square" />;

            const hasWorkout = dayWorkouts.length > 0;
            const volume = dayWorkouts.reduce((s, w) => s + (w.totalVolumeKg || 0), 0);

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (hasWorkout && dayWorkouts.length === 1) {
                    navigate(`/workouts/${dayWorkouts[0].id}`);
                  } else if (hasWorkout) {
                    // Multiple workouts: could show a picker, for now go to history
                    navigate('/workouts');
                  }
                }}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center relative
                  transition-colors text-xs
                  ${isToday ? 'ring-1 ring-emerald-500' : ''}
                  ${hasWorkout
                    ? 'bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700/30'
                    : 'bg-gray-900/50 border border-gray-800/50 hover:border-gray-700'}`}
                style={{ minHeight: '44px' }}
              >
                <span className={`font-medium ${isToday ? 'text-emerald-400' : hasWorkout ? 'text-white' : 'text-gray-500'}`}>
                  {day}
                </span>
                {hasWorkout && (
                  <>
                    <span className="text-[10px] text-emerald-400/70">{dayWorkouts.length}次</span>
                    {volume > 0 && (
                      <span className="text-[9px] text-gray-400 absolute bottom-1">
                        {(volume / 1000).toFixed(0)}k
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly workout list */}
      {monthlyWorkouts.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">本月训练记录</h2>
          <div className="space-y-2">
            {monthlyWorkouts.map(w => (
              <button
                key={w.id}
                onClick={() => navigate(`/workouts/${w.id}`)}
                className="w-full bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-emerald-600
                           transition-colors text-left flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-white">
                    {new Date(w.startTime).toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(w.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{w._count?.exerciseSets || 0} 组
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold text-sm">{(w.totalVolumeKg || 0).toLocaleString()} kg</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
