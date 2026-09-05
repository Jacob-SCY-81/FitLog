import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client.js';
import { tExerciseName, tMuscle, tEquipment } from '../utils/i18n.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import ExerciseMedia from '../components/ExerciseMedia.jsx';
import { formatDate, formatTime } from '../utils/format.js';

const SET_TYPE_LABELS = { warmup: '热身', standard: '正式', dropset: '递减', failure: '力竭' };

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiClient.get(`/workouts/${id}`)
      .then(({ data }) => setWorkout(data.data))
      .catch((err) => setError(err.response?.data?.message || '加载失败，请刷新重试'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.delete(`/workouts/${id}`);
      navigate('/workouts');
    } catch (err) {
      alert(err.response?.data?.message || '删除失败');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onBack={() => navigate('/workouts')} />;
  if (!workout) return null;

  // Group sets by exercise
  const exerciseGroups = [];
  const setMap = new Map();
  workout.exerciseSets.forEach(s => {
    if (!setMap.has(s.exerciseId)) {
      setMap.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        exercise: s.exercise,
        sortOrder: s.sortOrder,
        sets: [],
      });
    }
    setMap.get(s.exerciseId).sets.push(s);
  });
  // Sort by sortOrder
  [...setMap.values()].sort((a, b) => a.sortOrder - b.sortOrder).forEach(g => exerciseGroups.push(g));

  return (
    <div className="min-h-dvh pb-16 max-w-4xl mx-auto lg:max-w-6xl">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800
                      flex items-center gap-3">
        <Link to="/workouts" className="p-1 -ml-1 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{formatDate(workout.startTime)}</h1>
          <p className="text-xs text-gray-400">
            {formatTime(workout.startTime)}
            {workout.endTime && ` — ${formatTime(workout.endTime)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
            style={{ minHeight: '44px' }}
          >
            编辑
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-gray-800 hover:bg-red-900/40 rounded-lg transition-colors"
            style={{ minHeight: '44px' }}
          >
            删除
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        <StatCard label="总训练量" value={`${(workout.totalVolumeKg || 0).toLocaleString()} kg`} />
        <StatCard label="动作数" value={`${exerciseGroups.length}`} />
        <StatCard label="总组数" value={`${workout.exerciseSets.length}`} />
      </div>

      {/* Exercise Groups */}
      <div className="px-4 mt-2 space-y-4">
        {exerciseGroups.map(group => (
          <div key={group.exerciseId} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
            <div className="px-4 py-3 bg-gray-800/50 flex items-center gap-3">
              {group.exercise.mediaUrl && (
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <ExerciseMedia src={group.exercise.mediaUrl} className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <h3 className="font-medium text-white">
                  {group.exercise.id ? tExerciseName(group.exercise.id) || group.exercise.name : group.exercise.name}
                </h3>
                <p className="text-xs text-gray-400">
                  {tMuscle(group.exercise.targetMuscle)}{group.exercise.equipment ? ` · ${tEquipment(group.exercise.equipment)}` : ''}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-800">
                    <th className="px-3 py-2 text-left font-medium">组</th>
                    <th className="px-3 py-2 text-left font-medium">类型</th>
                    <th className="px-3 py-2 text-right font-medium">重量</th>
                    <th className="px-3 py-2 text-right font-medium">次数</th>
                    <th className="px-3 py-2 text-right font-medium">RPE</th>
                    <th className="px-3 py-2 text-right font-medium">休息</th>
                  </tr>
                </thead>
                <tbody>
                  {group.sets.map(s => (
                    <tr key={s.id} className={`border-b border-gray-800/50 ${s.isCompleted ? '' : 'opacity-40'}`}>
                      <td className="px-3 py-2.5">
                        <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs
                          ${s.isCompleted ? 'bg-emerald-600/30 text-emerald-300' : 'bg-gray-800 text-gray-500'}`}>
                          {s.setIndex}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs">{SET_TYPE_LABELS[s.setType] || s.setType}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{s.weight} kg</td>
                      <td className="px-3 py-2.5 text-right font-mono">{s.reps}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-400">
                        {s.rpe != null ? s.rpe : '--'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-400">
                        {s.actualRestTimeSec > 0 ? `${s.actualRestTimeSec}s` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {workout.notes && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 mb-1">备注</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{workout.notes}</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditWorkoutModal
          workout={workout}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            setWorkout(prev => ({ ...prev, ...updated }));
            setShowEdit(false);
          }}
        />
      )}

      {/* Delete Modal */}
      <ConfirmModal
        open={showDelete}
        title="确认删除"
        message="此操作不可恢复。确定要删除这条训练记录吗？"
        confirmText="确认删除"
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}

function EditWorkoutModal({ workout, onClose, onUpdated }) {
  const [notes, setNotes] = useState(workout.notes || '');
  const [endTime, setEndTime] = useState(
    workout.endTime ? new Date(workout.endTime).toISOString().slice(0, 16) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        notes: notes.trim() || null,
        ...(endTime ? { endTime: new Date(endTime).toISOString() } : {}),
      };
      const { data } = await apiClient.put(`/workouts/${workout.id}`, payload);
      onUpdated(data.data);
    } catch (err) {
      setError(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 space-y-4
                      border border-gray-800 shadow-2xl animate-[slideUp_0.2s_ease-out]">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h2 className="text-lg font-bold text-white">编辑训练记录</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white"
            style={{ minWidth: '40px', minHeight: '40px' }}>✕</button>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">训练备注</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="记录本次训练心得、身体状态或突破..."
              className="w-full px-3 py-2 bg-gray-800 rounded-xl text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none resize-none placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">结束时间（选填）</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded-xl text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium text-gray-300 transition-colors"
              style={{ minHeight: '44px' }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-sm font-bold text-white transition-colors shadow-md"
              style={{ minHeight: '44px' }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
      <p className="text-lg font-bold text-emerald-400">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
