import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import { useAuthStore } from '../stores/authStore.js';
import { useWorkoutStore } from '../stores/workoutStore.js';
import { tExerciseName, tMuscle, tEquipment } from '../utils/i18n.js';

const SET_TYPES = [
  { value: 'warmup', label: '热身', color: 'text-yellow-400' },
  { value: 'standard', label: '正式', color: 'text-emerald-400' },
  { value: 'dropset', label: '递减', color: 'text-orange-400' },
  { value: 'failure', label: '力竭', color: 'text-red-400' },
];

export default function WorkoutRecorder() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const store = useWorkoutStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [restTimer, setRestTimer] = useState(null);
  // AC-03.7: User-customizable rest duration
  const [restSeconds, setRestSeconds] = useState(90);
  const [showRestSettings, setShowRestSettings] = useState(false);

  // Initialize draft on mount (Home page already handles recovery dialog)
  useEffect(() => {
    if (user?.id) {
      store.initDraft(user.id);
    }
  }, [user?.id]); // eslint-disable-line

  // AC-03.3 & Data Safety: Flush draft immediately on pagehide / beforeunload / unmount
  useEffect(() => {
    const handleFlush = () => {
      if (user?.id) {
        store.flushDraft(user.id);
      }
    };
    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
      if (user?.id) {
        store.flushDraft(user.id);
      }
    };
  }, [user?.id]); // eslint-disable-line

  // Set start time when first exercise is added
  useEffect(() => {
    if (store.exercises.length > 0 && !store.startTime && user?.id) {
      useWorkoutStore.setState({ startTime: new Date().toISOString() });
    }
  }, [store.exercises.length, store.startTime, user?.id]);

  // Rest timer interval
  useEffect(() => {
    if (!restTimer) return;
    const interval = setInterval(() => {
      setRestTimer(prev => {
        if (!prev || prev.seconds <= 0) {
          clearInterval(interval);
          return null;
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimer?.id]); // Use unique id to avoid stale closure issues

  // AC-04.2: Calculate actualRestTimeSec from consecutive completedAt timestamps
  function calculateRestTimes(exercises) {
    return exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map((s, idx) => {
        if (idx === 0 || !s.isCompleted) return { ...s, actualRestTimeSec: 0 };
        const prevSet = ex.sets[idx - 1];
        if (!prevSet?.completedAt || !s.completedAt) return { ...s, actualRestTimeSec: 0 };
        const rest = Math.round(
          (new Date(s.completedAt) - new Date(prevSet.completedAt)) / 1000
        );
        return { ...s, actualRestTimeSec: Math.max(0, rest) };
      }),
    }));
  }

  function handleSetCompleted(sortOrder, setIndex) {
    store.updateSet(sortOrder, setIndex, 'isCompleted', true, user.id);
    const ex = store.exercises.find(e => e.sortOrder === sortOrder);
    if (ex) {
      const timerId = Date.now();
      setRestTimer({
        id: timerId,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        setIndex,
        seconds: restSeconds,
        target: restSeconds,
      });
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }

  function calculateVolume() {
    let total = 0;
    store.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        const w = parseFloat(s.weight);
        const r = parseInt(s.reps);
        if (!isNaN(w) && !isNaN(r)) total += w * r;
      });
    });
    return Math.round(total * 100) / 100;
  }

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const totalVolumeKg = calculateVolume();
      // AC-04.2: Calculate actualRestTimeSec from completedAt timestamps
      const exercisesWithRest = calculateRestTimes(store.exercises);

      const exercises = exercisesWithRest.map(ex => ({
        exerciseId: ex.exerciseId,
        sortOrder: ex.sortOrder,
        sets: ex.sets.map(s => ({
          exerciseId: ex.exerciseId,
          sortOrder: ex.sortOrder,
          setIndex: s.setIndex,
          setType: s.setType,
          weight: parseFloat(s.weight) || 0,
          reps: parseInt(s.reps) || 0,
          rpe: s.rpe ? parseFloat(s.rpe) : null,
          completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
          actualRestTimeSec: s.actualRestTimeSec || 0,
          isCompleted: !!s.isCompleted,
        })),
      }));

      const idempotencyKey = `workout_${user?.id || 'uid'}_${store.startTime || Date.now()}`;

      await apiClient.post('/workouts', {
        startTime: store.startTime || new Date().toISOString(),
        endTime: new Date().toISOString(),
        notes: store.notes || null,
        totalVolumeKg,
        exercises,
      }, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });

      store.clearDraft(user.id);
      navigate('/workouts');
    } catch (err) {
      setError(err.response?.data?.message || '提交失败，草稿已保留');
    } finally {
      setSubmitting(false);
    }
  }

  const volume = calculateVolume();
  const allCompleted = store.exercises.length > 0 && store.exercises.every(ex =>
    ex.sets.every(s => s.isCompleted)
  );

  function handleAddRestSeconds(extra) {
    setRestTimer(prev => prev ? { ...prev, seconds: prev.seconds + extra, target: prev.target + extra } : null);
  }

  return (
    <div className="min-h-dvh pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800
                      flex items-center justify-between">
        <h1 className="text-lg font-bold">训练记录</h1>
        <div className="flex items-center gap-2">
          {/* Rest timer setting */}
          <button
            onClick={() => setShowRestSettings(!showRestSettings)}
            className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 rounded-lg"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            ⏱ {restSeconds}s
          </button>
          <button
            onClick={() => setShowAddExercise(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium"
            style={{ minHeight: '44px' }}
          >
            + 动作
          </button>
        </div>
      </div>

      {/* Rest timer settings */}
      {showRestSettings && (
        <div className="mx-4 mt-3 bg-gray-900 rounded-xl border border-gray-800 p-3">
          <p className="text-xs text-gray-400 mb-2">组间休息时长（秒）</p>
          <div className="flex gap-2">
            {[30, 60, 90, 120, 180].map(s => (
              <button
                key={s}
                onClick={() => { setRestSeconds(s); setShowRestSettings(false); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                  ${restSeconds === s ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
                style={{ minHeight: '44px' }}
              >
                {s >= 60 ? `${s / 60}分` : `${s}秒`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exercises */}
      <div className="px-4 mt-4 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {store.exercises.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">开始你的训练</p>
            <p className="text-sm">点击"+ 动作"添加训练项目</p>
          </div>
        )}

        {store.exercises.map(ex => (
          <div key={ex.sortOrder} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
            {/* Exercise header */}
            <div className="px-4 py-3 flex items-center justify-between bg-gray-800/50">
              <div>
                <h3 className="font-medium text-white">
                  {ex.exerciseId ? tExerciseName(ex.exerciseId) || ex.exerciseName : ex.exerciseName}
                </h3>
                <p className="text-xs text-gray-400">{tMuscle(ex.targetMuscle)}</p>
              </div>
              <button
                onClick={() => store.removeExercise(ex.sortOrder, user.id)}
                className="p-2 text-gray-500 hover:text-red-400"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                ✕
              </button>
            </div>

            {/* Sets */}
            <div className="p-2 space-y-1">
              <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[10px] text-gray-500 uppercase">
                <span className="col-span-2">组</span>
                <span className="col-span-2">类型</span>
                <span className="col-span-3">重量(kg)</span>
                <span className="col-span-2">次数</span>
                <span className="col-span-1">RPE</span>
                <span className="col-span-2 text-center">✓</span>
              </div>

              {ex.sets.map(s => (
                <SetRow
                  key={s.setIndex}
                  sortOrder={ex.sortOrder}
                  set={s}
                  onChange={(field, value) => store.updateSet(ex.sortOrder, s.setIndex, field, value, user.id)}
                  onComplete={() => handleSetCompleted(ex.sortOrder, s.setIndex)}
                  onRemove={() => store.removeSet(ex.sortOrder, s.setIndex, user.id)}
                  isResting={restTimer?.exerciseName === ex.exerciseName && restTimer?.setIndex === s.setIndex}
                  restSeconds={restTimer?.seconds || 0}
                />
              ))}

              <button
                onClick={() => store.addSet(ex.sortOrder, user.id)}
                className="w-full py-2 mt-1 text-sm text-emerald-400 hover:text-emerald-300
                           hover:bg-gray-800/50 rounded-lg transition-colors"
                style={{ minHeight: '44px' }}
              >
                + 添加组
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {store.exercises.length > 0 && (
        <div className="px-4 mt-4">
          <textarea
            value={store.notes}
            onChange={(e) => store.setNotes(e.target.value, user.id)}
            placeholder="训练备注（选填）..."
            rows={2}
            className="w-full px-3 py-2 bg-gray-900 rounded-lg text-white text-sm border border-gray-800
                       focus:border-emerald-500 focus:outline-none resize-none placeholder-gray-600"
          />
        </div>
      )}

      {/* Submit bar */}
      {store.exercises.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-gray-950/95 backdrop-blur-sm border-t border-gray-800 px-4 py-3 z-30">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <div className="flex-1">
              <p className="text-xs text-gray-500">总训练量</p>
              <p className="text-lg font-bold text-emerald-400">{volume.toLocaleString()} kg</p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-gray-500">动作/组数</p>
              <p className="text-sm text-gray-300">
                {store.exercises.length}动作 / {store.exercises.reduce((sum, e) => sum + e.sets.length, 0)}组
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                         rounded-lg font-bold text-sm transition-colors"
              style={{ minHeight: '44px' }}
            >
              {submitting ? '提交中...' : '完成训练'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 text-center mt-1">{error}</p>}
        </div>
      )}

      {/* Rest Timer Overlay / Floating Bar */}
      {restTimer && (
        <RestTimerOverlay
          seconds={restTimer.seconds}
          target={restTimer.target}
          exerciseId={restTimer.exerciseId}
          exerciseName={restTimer.exerciseName}
          onDismiss={() => setRestTimer(null)}
          onAddSeconds={handleAddRestSeconds}
        />
      )}

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <AddExerciseModal
          onClose={() => setShowAddExercise(false)}
          onSelect={(exercise) => {
            store.addExercise(exercise, user.id);
            setShowAddExercise(false);
          }}
        />
      )}
    </div>
  );
}

function SetRow({ sortOrder, set, onChange, onComplete, onRemove, isResting, restSeconds }) {
  const [showSteppers, setShowSteppers] = useState(false);

  function adjustWeight(delta) {
    const current = parseFloat(set.weight) || 0;
    const next = Math.max(0, Math.round((current + delta) * 10) / 10);
    onChange('weight', next.toString());
  }

  function adjustReps(delta) {
    const current = parseInt(set.reps) || 0;
    const next = Math.max(0, current + delta);
    onChange('reps', next.toString());
  }

  return (
    <div className={`p-1 rounded-lg transition-colors space-y-1 ${
      set.isCompleted ? 'bg-emerald-900/20' : ''
    } ${isResting ? 'ring-1 ring-amber-500/50 bg-amber-900/10' : ''}`}>
      <div className="grid grid-cols-12 gap-1 items-center">
        {/* Set number */}
        <div className="col-span-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSteppers(!showSteppers)}
            title="点击展开快捷微调"
            className="text-xs text-gray-400 w-6 text-center hover:text-emerald-400 flex items-center justify-center font-mono"
            style={{ minHeight: '36px' }}
          >
            {set.setIndex}
          </button>
          {isResting && (
            <span className="text-[10px] text-amber-400 animate-pulse">{restSeconds}s</span>
          )}
        </div>

        {/* Set type */}
        <select
          value={set.setType}
          onChange={(e) => onChange('setType', e.target.value)}
          className="col-span-2 text-[10px] bg-transparent text-gray-400 focus:outline-none"
          style={{ minHeight: '44px' }}
        >
          {SET_TYPES.map(t => (
            <option key={t.value} value={t.value} className="bg-gray-900">{t.label}</option>
          ))}
        </select>

        {/* Weight */}
        <div className="col-span-3">
          <input
            type="text"
            inputMode="decimal"
            value={set.weight}
            onFocus={() => setShowSteppers(true)}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d*\.?\d*$/.test(v)) onChange('weight', v);
            }}
            placeholder="0"
            className="w-full px-1.5 py-2 bg-gray-800 rounded text-white text-sm text-center
                       border border-gray-700 focus:border-emerald-500 focus:outline-none font-medium"
            style={{ minHeight: '44px' }}
          />
        </div>

        {/* Reps */}
        <div className="col-span-2">
          <input
            type="text"
            inputMode="numeric"
            value={set.reps}
            onFocus={() => setShowSteppers(true)}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d*$/.test(v)) onChange('reps', v);
            }}
            placeholder="0"
            className="w-full px-1.5 py-2 bg-gray-800 rounded text-white text-sm text-center
                       border border-gray-700 focus:border-emerald-500 focus:outline-none font-medium"
            style={{ minHeight: '44px' }}
          />
        </div>

        {/* RPE */}
        <div className="col-span-1">
          <input
            type="text"
            inputMode="decimal"
            value={set.rpe ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^(\d|10)(\.\d?)?$/.test(v)) {
                onChange('rpe', v === '' ? null : v);
              }
            }}
            placeholder="-"
            className="w-full px-0.5 py-2 bg-gray-800 rounded text-white text-xs text-center
                       border border-gray-700 focus:border-emerald-500 focus:outline-none"
            style={{ minHeight: '44px' }}
          />
        </div>

        {/* Complete + Remove */}
        <div className="col-span-2 flex items-center justify-center gap-0.5">
          <button
            onClick={() => {
              if (!set.isCompleted) onComplete();
              else onChange('isCompleted', false);
            }}
            className="p-2 text-lg active:scale-95 transition-transform"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            {set.isCompleted ? '✅' : '⬜'}
          </button>
          <button
            onClick={onRemove}
            className="p-2 text-gray-600 hover:text-red-400 text-sm"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Quick Stepper Bar */}
      {showSteppers && (
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800/90 rounded-lg border border-gray-700/60 animate-fadeIn">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-0.5">重量</span>
            <button
              type="button"
              onClick={() => adjustWeight(-5)}
              className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-[11px] font-mono"
            >
              -5
            </button>
            <button
              type="button"
              onClick={() => adjustWeight(-2.5)}
              className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-[11px] font-mono"
            >
              -2.5
            </button>
            <button
              type="button"
              onClick={() => adjustWeight(2.5)}
              className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 text-emerald-400 font-semibold rounded text-[11px] font-mono"
            >
              +2.5
            </button>
            <button
              type="button"
              onClick={() => adjustWeight(5)}
              className="px-1.5 py-1 bg-gray-700 hover:bg-gray-600 text-emerald-400 font-semibold rounded text-[11px] font-mono"
            >
              +5
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-0.5">次数</span>
            <button
              type="button"
              onClick={() => adjustReps(-1)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-[11px] font-mono"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => adjustReps(1)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-emerald-400 font-semibold rounded text-[11px] font-mono"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => setShowSteppers(false)}
              className="ml-1 px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RestTimerOverlay({ seconds, target, exerciseId, exerciseName, onDismiss, onAddSeconds }) {
  const [minimized, setMinimized] = useState(false);
  const progress = target > 0 ? (seconds / target) * 100 : 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const displayName = exerciseId ? (tExerciseName(exerciseId) || exerciseName) : exerciseName;

  useEffect(() => {
    if (seconds === 0) {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 500]);
      }
      const timer = setTimeout(() => {
        onDismiss();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [seconds, onDismiss]);

  // 最小化模式（底部悬浮胶囊条）
  if (minimized) {
    return (
      <div
        data-testid="floating-rest-timer"
        className="fixed bottom-28 sm:bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-gray-900/95
                   border border-amber-500/50 rounded-2xl shadow-2xl p-3 backdrop-blur-md flex items-center justify-between animate-fadeIn"
      >
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => setMinimized(false)}
          title="点击展开全屏计时器"
        >
          <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(55,65,81)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16" fill="none"
                stroke={seconds === 0 ? 'rgb(52,211,153)' : 'rgb(251,191,36)'}
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - progress / 100)}`}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute text-[10px]">⏱</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-base font-bold tabular-nums ${seconds === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {timeStr}
              </span>
              <span className="text-[11px] text-gray-400 truncate max-w-[100px]">
                {seconds === 0 ? '休息完成' : displayName}
              </span>
            </div>
            <p className="text-[10px] text-gray-500">点击展开全屏</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onAddSeconds && seconds > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAddSeconds(30); }}
              className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/30"
              style={{ minHeight: '36px' }}
            >
              +30s
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs"
            style={{ minHeight: '36px' }}
          >
            跳过
          </button>
        </div>
      </div>
    );
  }

  // 全屏模态模式
  return (
    <div
      data-testid="full-rest-timer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) setMinimized(true); }}
    >
      <div className="text-center space-y-5 max-w-xs w-full bg-gray-900/90 border border-gray-800 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>组间休息</span>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="p-1 hover:text-white"
            title="收起为浮条"
            style={{ minHeight: '36px', minWidth: '36px' }}
          >
            🗕 最小化
          </button>
        </div>

        <p className="text-sm font-semibold text-white truncate">{displayName}</p>

        <div className="relative w-36 h-36 mx-auto">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(55,65,81)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={seconds === 0 ? 'rgb(52,211,153)' : 'rgb(251,191,36)'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-extrabold tabular-nums tracking-tight ${
              seconds === 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {timeStr}
            </span>
            {seconds === 0 && <span className="text-xs text-emerald-400 mt-1 font-bold">休息完成!</span>}
          </div>
        </div>

        <div className="flex gap-2">
          {onAddSeconds && seconds > 0 && (
            <button
              type="button"
              onClick={() => onAddSeconds(30)}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-semibold text-amber-300 border border-amber-500/30 transition-colors"
              style={{ minHeight: '44px' }}
            >
              +30 秒
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium text-gray-300 transition-colors"
            style={{ minHeight: '44px' }}
          >
            {seconds === 0 ? '完成' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddExerciseModal({ onClose, onSelect }) {
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = { page: 1, limit: 50 };
      if (search) params.search = search;
      apiClient.get('/exercises', { params })
        .then(({ data }) => setExercises(data.data.data || []))
        .catch(() => setExercises([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mt-auto sm:mt-16 sm:mb-auto w-full sm:max-w-md mx-auto bg-gray-900
                      rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold flex-1">添加动作</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"
              style={{ minWidth: '44px', minHeight: '44px' }}>✕</button>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索动作..."
            className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                       focus:border-emerald-500 focus:outline-none placeholder-gray-500"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : (
            exercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
                style={{ minHeight: '44px' }}
              >
                <div className="flex-1">
                  <p className="text-sm text-white">
                    {ex.isOfficial !== false && ex.id ? tExerciseName(ex.id, ex.name) || ex.name : ex.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {tMuscle(ex.targetMuscle)}{ex.equipment ? ` · ${tEquipment(ex.equipment)}` : ''}
                  </p>
                </div>
                <span className="text-emerald-400 text-lg">+</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
