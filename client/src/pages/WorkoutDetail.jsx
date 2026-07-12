import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client.js';
import { tExerciseName, tMuscle, tEquipment } from '../utils/i18n.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatDate, formatTime } from '../utils/format.js';

const SET_TYPE_LABELS = { warmup: '热身', standard: '正式', dropset: '递减', failure: '力竭' };

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
        <button
          onClick={() => setShowDelete(true)}
          className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300"
          style={{ minHeight: '44px' }}
        >
          删除
        </button>
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
                <img src={group.exercise.mediaUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
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

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
      <p className="text-lg font-bold text-emerald-400">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
