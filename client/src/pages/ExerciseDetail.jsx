import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client.js';
import { tMuscle, tEquipment, tLevel, tExerciseName, tMechanic } from '../utils/i18n.js';
import ExerciseAnimation from '../components/ExerciseAnimation.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiClient.get(`/exercises/${id}`)
      .then(({ data }) => setExercise(data.data))
      .catch((err) => setError(err.response?.data?.message || '加载失败，请刷新重试'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.delete(`/exercises/${id}`);
      navigate('/exercises');
    } catch (err) {
      alert(err.response?.data?.message || '删除失败');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onBack={() => navigate('/exercises')} />;

  if (!exercise) return null;

  // Use images array from API (official exercises), or mediaUrl for custom
  const images = exercise.images || (exercise.mediaUrl ? [exercise.mediaUrl] : []);

  return (
    <div className="min-h-dvh pb-16 max-w-7xl mx-auto">
      {/* Back button */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
        <Link to="/exercises" className="p-1 -ml-1 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white truncate">
            {exercise.isOfficial ? tExerciseName(exercise.id) : exercise.name}
          </h1>
          {exercise.isOfficial && (
            <p className="text-xs text-gray-500">{exercise.name}</p>
          )}
        </div>
        {!exercise.isOfficial && (
          <button
            onClick={() => setShowDelete(true)}
            className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 rounded-lg text-sm text-red-300"
          >
            删除
          </button>
        )}
      </div>

      {/* Image Gallery + Info */}
      <div className="lg:flex lg:gap-6 lg:px-4 lg:py-4">
      <div className="bg-gray-900 lg:flex-1">
        {images.length > 0 ? (
          <div className="aspect-[4/3] bg-gray-800 relative">
            <ExerciseAnimation
              images={images}
              alt={exercise.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[4/3] bg-gray-800 flex items-center justify-center">
            <div className="text-center text-gray-600">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-sm">暂无图片</p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-4 space-y-4 lg:flex-1 lg:px-0">
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="目标肌群" value={tMuscle(exercise.targetMuscle)} />
          <InfoCard label="器械" value={tEquipment(exercise.equipment)} />
          {exercise.isOfficial && exercise.level && (
            <InfoCard label="难度" value={tLevel(exercise.level)} />
          )}
          {exercise.isOfficial && exercise.mechanic && (
            <InfoCard label="类型" value={tMechanic(exercise.mechanic)} />
          )}
          <InfoCard label="来源" value={exercise.isOfficial ? '官方库' : '自定义'} />
        </div>

        {/* Instructions */}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">动作说明</h3>
            <ol className="space-y-2">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-400">
                  <span className="text-emerald-500 font-medium shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Notes for custom exercises */}
        {!exercise.isOfficial && exercise.notes && (
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">备注</h3>
            <p className="text-sm text-gray-400">{exercise.notes}</p>
          </div>
        )}
      </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDelete}
        title="确认删除"
        message={`删除自定义动作 "${exercise.name}"？已关联的训练记录将保留，但该动作将不再可用。`}
        confirmText="确认删除"
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm text-white capitalize">{value}</p>
    </div>
  );
}
