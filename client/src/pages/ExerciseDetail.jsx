import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client.js';
import { tMuscle, tEquipment, tLevel, tExerciseName, tMechanic } from '../utils/i18n.js';
import { MUSCLE_LABELS } from '../constants/muscles.js';
import ExerciseMedia from '../components/ExerciseMedia.jsx';
import ExerciseMediaLightbox from '../components/ExerciseMediaLightbox.jsx';
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
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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
  const images = exercise.images && exercise.images.length > 0
    ? exercise.images
    : (exercise.mediaUrl ? [exercise.mediaUrl] : []);

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
            {exercise.isOfficial ? tExerciseName(exercise.id, exercise.name) : exercise.name}
          </h1>
          {exercise.isOfficial && (
            <p className="text-xs text-gray-500">{exercise.name}</p>
          )}
        </div>
        {!exercise.isOfficial && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200"
              style={{ minHeight: '44px' }}
            >
              编辑
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 rounded-lg text-sm text-red-300"
              style={{ minHeight: '44px' }}
            >
              删除
            </button>
          </div>
        )}
      </div>

      {/* Image Gallery + Info */}
      <div className="lg:flex lg:gap-6 lg:px-4 lg:py-4">
        <div className="bg-gray-900 lg:flex-1">
          <div
            className="aspect-[4/3] bg-gray-800 relative cursor-pointer"
            onClick={() => {
              if (images.length > 0) {
                setLightboxIndex(0);
                setLightboxOpen(true);
              }
            }}
          >
            <ExerciseMedia
              images={images}
              alt={exercise.name}
              className="w-full h-full object-cover"
              showExpandBtn={images.length > 0}
              onExpand={({ currentIndex }) => {
                setLightboxIndex(currentIndex);
                setLightboxOpen(true);
              }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-4 space-y-4 lg:flex-1 lg:py-0">
          {/* Basic metadata */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="目标肌群" value={tMuscle(exercise.targetMuscle)} />
            <InfoCard label="器械" value={tEquipment(exercise.equipment)} />
            {exercise.level && <InfoCard label="难度" value={tLevel(exercise.level)} />}
            {exercise.mechanic && <InfoCard label="动作类型" value={tMechanic(exercise.mechanic)} />}
          </div>

          {/* Secondary Muscles */}
          {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">次要肌群</h3>
              <div className="flex flex-wrap gap-1.5">
                {exercise.secondaryMuscles.map((m) => (
                  <span key={m} className="px-2.5 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
                    {tMuscle(m)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {exercise.instructions && exercise.instructions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">动作要领</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
                {exercise.instructions.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Notes for custom exercise */}
          {exercise.notes && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300 mb-1">自定义动作备注</h3>
              <p className="text-sm text-gray-400 whitespace-pre-wrap">{exercise.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Media Lightbox Modal */}
      <ExerciseMediaLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={exercise.isOfficial ? tExerciseName(exercise.id, exercise.name) : exercise.name}
        mediaList={images}
        initialIndex={lightboxIndex}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={showDelete}
        title="确认删除自定义动作？"
        message={`确定要删除「${exercise.name}」吗？已记录的训练历史数据仍将保留。`}
        confirmText={deleting ? '删除中...' : '确认删除'}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      {/* Edit custom exercise modal */}
      {showEdit && (
        <EditExerciseModal
          exercise={exercise}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            setExercise(prev => ({ ...prev, ...updated }));
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}

function EditExerciseModal({ exercise, onClose, onUpdated }) {
  const [name, setName] = useState(exercise.name || '');
  const [targetMuscle, setTargetMuscle] = useState(exercise.targetMuscle || '');
  const [equipment, setEquipment] = useState(exercise.equipment || '');
  const [notes, setNotes] = useState(exercise.notes || '');
  const [mediaUrl, setMediaUrl] = useState(exercise.mediaUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.put(`/exercises/${exercise.id}`, {
        name,
        targetMuscle,
        equipment: equipment || null,
        notes: notes || null,
        mediaUrl: mediaUrl.trim() || null,
      });
      onUpdated(data.data);
    } catch (err) {
      setError(err.response?.data?.message || '更新失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full sm:max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 space-y-4
                      animate-[slideUp_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold">编辑自定义动作</h2>
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
          <div>
            <label className="block text-sm text-gray-400 mb-1">演示媒体/图片链接 (可选)</label>
            <input
              type="text" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
              placeholder="https://... 或 /media/..."
            />
            {mediaUrl.trim() && (
              <div className="mt-2 p-2 bg-gray-950 rounded-lg border border-gray-800 flex items-center gap-3">
                <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-800 shrink-0">
                  <ExerciseMedia src={mediaUrl.trim()} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 truncate">媒体实时预览</p>
                  <p className="text-[10px] text-gray-500 truncate">{mediaUrl.trim()}</p>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">备注说明</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
              placeholder="动作细节或注意点"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
              取消
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
              {loading ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
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
