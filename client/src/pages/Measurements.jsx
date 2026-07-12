import { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function Measurements() {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [weightTrend, setWeightTrend] = useState([]);
  const [trendDays, setTrendDays] = useState(90);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchMeasurements = () => {
    setLoading(true);
    setError('');
    apiClient.get('/measurements', { params: { page, limit: 20 } })
      .then(({ data }) => {
        setMeasurements(data.data.data || []);
        setTotal(data.data.total || 0);
      })
      .catch((err) => setError(err.response?.data?.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMeasurements(); }, [page]);

  // Fetch weight trend
  useEffect(() => {
    apiClient.get('/measurements/trend', { params: { days: trendDays } })
      .then(({ data }) => setWeightTrend(data.data || []))
      .catch(() => {});
  }, [trendDays]);

  return (
    <div className="min-h-dvh pb-16 max-w-4xl mx-auto lg:max-w-6xl">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800
                      flex items-center justify-between">
        <h1 className="text-xl font-bold">身体数据</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold"
          style={{ minHeight: '44px' }}
        >
          + 记录
        </button>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Weight trend chart */}
        {weightTrend.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">体重趋势 (kg)</h3>
              <div className="flex gap-1">
                {[30, 90, 180, 365].map(d => (
                  <button
                    key={d}
                    onClick={() => setTrendDays(d)}
                    className={`px-2 py-1 rounded text-xs ${trendDays === d ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    {d}天
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(55,65,81)" />
                <XAxis dataKey="date" stroke="rgb(107,114,128)" tick={{ fontSize: 11 }}
                  tickFormatter={(v) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                <YAxis stroke="rgb(107,114,128)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'rgb(17,24,39)', border: '1px solid rgb(55,65,81)', borderRadius: '8px' }}
                  labelStyle={{ color: 'white' }}
                  formatter={(v) => [`${Number(v).toFixed(1)} kg`, '体重']}
                />
                <Line type="monotone" dataKey="weight" stroke="rgb(52,211,153)" strokeWidth={2}
                  dot={{ r: 3, fill: 'rgb(52,211,153)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Latest measurements */}
        {measurements.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">最新数据</h3>
            <div className="grid grid-cols-2 gap-3">
              {measurements[0].weightKg != null && <MeasureCard label="体重" value={`${measurements[0].weightKg} kg`} />}
              {measurements[0].bodyFatPct != null && <MeasureCard label="体脂率" value={`${measurements[0].bodyFatPct}%`} />}
              {measurements[0].chestCm != null && <MeasureCard label="胸围" value={`${measurements[0].chestCm} cm`} />}
              {measurements[0].waistCm != null && <MeasureCard label="腰围" value={`${measurements[0].waistCm} cm`} />}
              {measurements[0].hipCm != null && <MeasureCard label="臀围" value={`${measurements[0].hipCm} cm`} />}
              {measurements[0].armCm != null && <MeasureCard label="臂围" value={`${measurements[0].armCm} cm`} />}
              {measurements[0].thighCm != null && <MeasureCard label="腿围" value={`${measurements[0].thighCm} cm`} />}
            </div>
          </div>
        )}

        {/* Measurement history */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">历史记录</h3>

          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <ErrorMessage message={error} onRetry={fetchMeasurements} />
          ) : measurements.length === 0 ? (
            <EmptyState
              icon="📏"
              title="还没有身体数据"
              description="记录你的体重、围度等数据，追踪身体变化趋势"
              actionLabel="记录第一条数据"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="space-y-2">
              {measurements.map(m => (
                <MeasurementRow key={m.id} measurement={m} onDeleted={(id) => {
                  setMeasurements(prev => prev.filter(p => p.id !== id));
                  setTotal(prev => prev - 1);
                }} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 bg-gray-800 rounded-lg text-sm disabled:opacity-30">
                上一页
              </button>
              <span className="text-sm text-gray-400">{page}/{Math.ceil(total / 20)}</span>
              <button onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))}
                disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-2 bg-gray-800 rounded-lg text-sm disabled:opacity-30">
                下一页
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Measurement Form */}
      {showForm && (
        <MeasurementForm
          onClose={() => setShowForm(false)}
          onCreated={(m) => {
            setMeasurements(prev => [m, ...prev]);
            setTotal(prev => prev + 1);
            setShowForm(false);
            // Refresh weight trend
            apiClient.get('/measurements/trend', { params: { days: trendDays } })
              .then(({ data }) => setWeightTrend(data.data || []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function MeasureCard({ label, value }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-emerald-400">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function MeasurementRow({ measurement, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiClient.delete(`/measurements/${measurement.id}`);
      onDeleted(measurement.id);
    } catch (err) {
      alert(err.response?.data?.message || '删除失败');
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  }

  const items = [];
  if (measurement.weightKg != null) items.push(`${measurement.weightKg}kg`);
  if (measurement.bodyFatPct != null) items.push(`体脂${measurement.bodyFatPct}%`);
  if (measurement.chestCm != null) items.push(`胸${measurement.chestCm}`);
  if (measurement.waistCm != null) items.push(`腰${measurement.waistCm}`);

  return (
    <>
      <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white">
              {new Date(measurement.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{items.join(' · ')}</p>
          {measurement.notes && (
            <p className="text-xs text-gray-500 mt-1 truncate">{measurement.notes}</p>
          )}
        </div>
        <button
          onClick={() => setShowDelete(true)}
          className="p-2 text-gray-600 hover:text-red-400 text-xs"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          删除
        </button>
      </div>

      <ConfirmModal
        open={showDelete}
        title="确认删除"
        message="删除后该数据将无法恢复。"
        confirmText="确认删除"
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
}

function MeasurementForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weightKg: '',
    bodyFatPct: '',
    chestCm: '',
    waistCm: '',
    hipCm: '',
    armCm: '',
    thighCm: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Require at least one measurement
    const hasData = ['weightKg', 'bodyFatPct', 'chestCm', 'waistCm', 'hipCm', 'armCm', 'thighCm']
      .some(k => form[k] !== '' && form[k] != null);
    if (!hasData) {
      setError('请至少填写一项身体数据');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        date: new Date(form.date).toISOString(),
        weightKg: form.weightKg !== '' ? parseFloat(form.weightKg) : null,
        bodyFatPct: form.bodyFatPct !== '' ? parseFloat(form.bodyFatPct) : null,
        chestCm: form.chestCm !== '' ? parseFloat(form.chestCm) : null,
        waistCm: form.waistCm !== '' ? parseFloat(form.waistCm) : null,
        hipCm: form.hipCm !== '' ? parseFloat(form.hipCm) : null,
        armCm: form.armCm !== '' ? parseFloat(form.armCm) : null,
        thighCm: form.thighCm !== '' ? parseFloat(form.thighCm) : null,
        notes: form.notes || null,
      };
      const { data } = await apiClient.post('/measurements', payload);
      onCreated(data.data);
    } catch (err) {
      setError(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mt-auto sm:mt-16 sm:mb-auto w-full sm:max-w-md mx-auto bg-gray-900
                      rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold">记录身体数据</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"
            style={{ minWidth: '44px', minHeight: '44px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">日期</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">体重 (kg)</label>
              <input
                type="number"
                value={form.weightKg}
                onChange={(e) => update('weightKg', e.target.value)}
                placeholder="0.0"
                step={0.1} min={20} max={500}
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                           focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">体脂率 (%)</label>
              <input
                type="number"
                value={form.bodyFatPct}
                onChange={(e) => update('bodyFatPct', e.target.value)}
                placeholder="0.0"
                step={0.1} min={1} max={60}
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                           focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">胸围 (cm)</label>
              <input
                type="number"
                value={form.chestCm}
                onChange={(e) => update('chestCm', e.target.value)}
                placeholder="0.0"
                step={0.1} min={50} max={200}
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                           focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">腰围 (cm)</label>
              <input
                type="number"
                value={form.waistCm}
                onChange={(e) => update('waistCm', e.target.value)}
                placeholder="0.0"
                step={0.1} min={50} max={200}
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                           focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">臀围 (cm)</label>
              <input
                type="number"
                value={form.hipCm}
                onChange={(e) => update('hipCm', e.target.value)}
                placeholder="0.0"
                step={0.1} min={50} max={200}
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                           focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">臂围 (cm)</label>
              <input
                type="number"
                value={form.armCm}
                onChange={(e) => update('armCm', e.target.value)}
                placeholder="0.0"
                step={0.1} min={20} max={100}
                className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                           focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">腿围 (cm)</label>
            <input
              type="number"
              value={form.thighCm}
              onChange={(e) => update('thighCm', e.target.value)}
              placeholder="0.0"
              step={0.1} min={30} max={120}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">备注（选填）</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="训练感受、饮食情况..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 rounded-lg text-white text-sm border border-gray-700
                         focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                       rounded-lg font-bold text-sm transition-colors"
            style={{ minHeight: '44px' }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  );
}
