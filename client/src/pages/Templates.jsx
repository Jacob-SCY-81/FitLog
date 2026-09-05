import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client.js';
import { useWorkoutStore } from '../stores/workoutStore.js';
import { useAuthStore } from '../stores/authStore.js';
import { tExerciseName, tMuscle, tEquipment } from '../utils/i18n.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function Templates() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = () => {
    setLoading(true);
    setError('');
    apiClient.get('/templates')
      .then(({ data }) => setTemplates(data.data || []))
      .catch((err) => setError(err.response?.data?.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/templates/${deleteTarget}`);
      setTemplates(prev => prev.filter(t => t.id !== deleteTarget));
    } catch (err) {
      alert(err.response?.data?.message || '删除失败');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleLoadTemplate(templateId) {
    try {
      const { data } = await apiClient.get(`/templates/${templateId}/workout`);
      const workoutData = data.data;
      const store = useWorkoutStore.getState();
      store.clearDraft(user.id);
      store.loadTemplateDraft(workoutData, user.id);
      navigate('/workouts/new');
    } catch (err) {
      alert(err.response?.data?.message || '加载模板失败');
    }
  }

  async function handleOpenEdit(templateId) {
    setEditLoading(true);
    try {
      const { data } = await apiClient.get(`/templates/${templateId}`);
      setEditTarget(data.data);
    } catch (err) {
      alert(err.response?.data?.message || '获取模板详情失败');
    } finally {
      setEditLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={fetchTemplates} />;

  return (
    <div className="min-h-dvh pb-16 max-w-4xl mx-auto lg:max-w-6xl">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800
                      flex items-center justify-between">
        <h1 className="text-xl font-bold">训练模板</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold shadow-md transition-colors"
          style={{ minHeight: '44px' }}
        >
          + 新建模板
        </button>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {templates.length === 0 ? (
          <EmptyState
            icon="📋"
            title="还没有训练模板"
            description="保存常用的训练计划为模板，下次训练时一键加载"
            actionLabel="新建模板"
            actionTo={null}
            onAction={() => setShowCreate(true)}
          />
        ) : (
          templates.map(t => (
            <div
              key={t.id}
              className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-base truncate">{t.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {t._count?.exercises || 0} 个动作
                    {' · '}更新于 {new Date(t.updatedAt).toLocaleDateString('zh-CN')}
                  </p>
                  {t.notes && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{t.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleLoadTemplate(t.id)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                  style={{ minHeight: '44px' }}
                >
                  开始训练
                </button>
                <button
                  onClick={() => handleOpenEdit(t.id)}
                  disabled={editLoading}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-200 transition-colors"
                  style={{ minHeight: '44px' }}
                >
                  编辑
                </button>
                <button
                  onClick={() => setDeleteTarget(t.id)}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-red-900/40 rounded-lg text-sm font-medium text-gray-400 hover:text-red-300 transition-colors"
                  style={{ minHeight: '44px' }}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Template Modal */}
      {(showCreate || editTarget) && (
        <TemplateModal
          initialData={editTarget}
          onClose={() => {
            setShowCreate(false);
            setEditTarget(null);
          }}
          onSaved={(saved) => {
            if (editTarget) {
              setTemplates(prev => prev.map(t => t.id === saved.id ? {
                ...t,
                ...saved,
                _count: { exercises: saved.exercises?.length ?? t._count?.exercises ?? 0 },
              } : t));
              setEditTarget(null);
            } else {
              setTemplates(prev => [
                {
                  ...saved,
                  _count: { exercises: saved.exercises?.length ?? 0 },
                },
                ...prev,
              ]);
              setShowCreate(false);
            }
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="确认删除"
        message="删除后该模板将无法恢复，关联的历史训练记录不受影响。"
        confirmText="确认删除"
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function TemplateModal({ initialData, onClose, onSaved }) {
  const isEdit = !!initialData?.id;
  const [name, setName] = useState(initialData?.name || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [templateExercises, setTemplateExercises] = useState(
    (initialData?.exercises || []).map((ex, idx) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exercise?.name || ex.exerciseName || '',
      targetMuscle: ex.exercise?.targetMuscle || ex.targetMuscle || '',
      sortOrder: ex.sortOrder || idx + 1,
      targetSets: ex.targetSets || 3,
      targetReps: ex.targetReps || 10,
      targetWeight: ex.targetWeight || 0,
      notes: ex.notes || '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [search, setSearch] = useState('');

  function openPicker() {
    setShowPicker(true);
    setPickerLoading(true);
    apiClient.get('/exercises', { params: { page: 1, limit: 100 } })
      .then(({ data }) => setAllExercises(data.data.data || []))
      .finally(() => setPickerLoading(false));
  }

  function addToTemplate(exercise) {
    setTemplateExercises(prev => [...prev, {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetMuscle: exercise.targetMuscle,
      sortOrder: prev.length + 1,
      targetSets: 3,
      targetReps: 10,
      targetWeight: 0,
      notes: '',
    }]);
    setShowPicker(false);
  }

  function removeFromTemplate(sortOrder) {
    setTemplateExercises(prev =>
      prev.filter(e => e.sortOrder !== sortOrder)
        .map((e, i) => ({ ...e, sortOrder: i + 1 }))
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('请输入模板名称');
      return;
    }
    if (templateExercises.length === 0) {
      setError('请至少添加一个动作');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      notes: notes.trim() || null,
      exercises: templateExercises.map(e => ({
        exerciseId: e.exerciseId,
        sortOrder: e.sortOrder,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        targetWeight: e.targetWeight,
        notes: e.notes || null,
      })),
    };

    try {
      let data;
      if (isEdit) {
        const res = await apiClient.put(`/templates/${initialData.id}`, payload);
        data = res.data;
      } else {
        const res = await apiClient.post('/templates', payload);
        data = res.data;
      }
      onSaved(data.data);
    } catch (err) {
      setError(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative mt-auto sm:mt-16 sm:mb-auto w-full sm:max-w-lg mx-auto bg-gray-900
                      rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col border border-gray-800 shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? '编辑训练模板' : '新建训练模板'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"
            style={{ minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Template name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">模板名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：推拉腿 Day 1"
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Template notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">备注（选填）</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="训练要点、注意事项..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Exercises */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">训练动作</label>
              <button
                type="button"
                onClick={openPicker}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-semibold text-emerald-400"
                style={{ minHeight: '40px' }}
              >
                + 添加动作
              </button>
            </div>

            {templateExercises.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-6 border border-dashed border-gray-800 rounded-xl">
                尚未添加动作，点击上方“+ 添加动作”开始配置
              </div>
            ) : (
              <div className="space-y-2.5">
                {templateExercises.map(ex => (
                  <div key={ex.sortOrder} className="bg-gray-800/80 rounded-xl p-3.5 border border-gray-700/60">
                    <div className="flex items-center justify-between mb-2.5">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {ex.exerciseId ? tExerciseName(ex.exerciseId, ex.exerciseName) || ex.exerciseName : ex.exerciseName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{tMuscle(ex.targetMuscle)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromTemplate(ex.sortOrder)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                        style={{ minWidth: '40px', minHeight: '40px' }}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">目标组数</label>
                        <input
                          type="number"
                          value={ex.targetSets}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                            setTemplateExercises(prev => prev.map(p =>
                              p.sortOrder === ex.sortOrder ? { ...p, targetSets: v } : p
                            ));
                          }}
                          className="w-full px-2 py-1.5 bg-gray-700/80 rounded-lg text-white text-xs text-center border border-gray-600 focus:border-emerald-500 focus:outline-none"
                          min={1} max={20}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">目标次数</label>
                        <input
                          type="number"
                          value={ex.targetReps}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                            setTemplateExercises(prev => prev.map(p =>
                              p.sortOrder === ex.sortOrder ? { ...p, targetReps: v } : p
                            ));
                          }}
                          className="w-full px-2 py-1.5 bg-gray-700/80 rounded-lg text-white text-xs text-center border border-gray-600 focus:border-emerald-500 focus:outline-none"
                          min={1} max={100}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">参考重量(kg)</label>
                        <input
                          type="number"
                          value={ex.targetWeight}
                          onChange={(e) => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0);
                            setTemplateExercises(prev => prev.map(p =>
                              p.sortOrder === ex.sortOrder ? { ...p, targetWeight: v } : p
                            ));
                          }}
                          className="w-full px-2 py-1.5 bg-gray-700/80 rounded-lg text-white text-xs text-center border border-gray-600 focus:border-emerald-500 focus:outline-none"
                          min={0} step={0.5}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                       rounded-xl font-bold text-sm text-white transition-colors shadow-md active:scale-[0.99]"
            style={{ minHeight: '44px' }}
          >
            {saving ? '保存中...' : (isEdit ? '保存修改' : '创建模板')}
          </button>
        </div>

        {/* Exercise Picker Sub-modal */}
        {showPicker && (
          <div className="absolute inset-0 bg-gray-900 rounded-t-2xl sm:rounded-2xl flex flex-col z-10">
            <div className="p-4 border-b border-gray-800 flex items-center gap-3">
              <button onClick={() => setShowPicker(false)} className="p-1 text-gray-400 hover:text-white"
                style={{ minWidth: '44px', minHeight: '44px' }}>← 返回</button>
              <h3 className="text-sm font-semibold flex-1">选择动作</h3>
            </div>
            <div className="p-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索动作..."
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                           focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {pickerLoading ? (
                <div className="text-center py-8 text-gray-400">加载中...</div>
              ) : (
                allExercises
                  .filter(ex => !search || ex.name.toLowerCase().includes(search.toLowerCase()))
                  .map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => addToTemplate(ex)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left border-b border-gray-800/50"
                      style={{ minHeight: '44px' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {tExerciseName(ex.id, ex.name) || ex.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tMuscle(ex.targetMuscle)}{ex.equipment ? ` · ${tEquipment(ex.equipment)}` : ''}
                        </p>
                      </div>
                      <span className="text-emerald-400 text-lg font-bold">+</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
