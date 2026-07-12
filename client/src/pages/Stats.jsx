import { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import { MUSCLE_LABELS } from '../constants/muscles.js';
import { tExerciseName } from '../utils/i18n.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

export default function Stats() {
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [days, setDays] = useState(90);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch exercises that have been used in workouts
  useEffect(() => {
    apiClient.get('/stats/exercises-used')
      .then(({ data }) => setExercises(data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    apiClient.get(`/stats/exercise/${selected}`, { params: { days } })
      .then(({ data }) => setChartData(data.data))
      .catch(() => setChartData(null))
      .finally(() => setLoading(false));
  }, [selected, days]);

  return (
    <div className="min-h-dvh pb-16 max-w-7xl mx-auto">
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-bold">数据统计</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Exercise selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">选择动作</label>
          {exercises.length === 0 ? (
            <EmptyState
              icon="📊"
              title="还没有训练数据"
              description="完成一次训练后，这里将展示你的力量增长趋势"
              actionLabel="开始第一次训练"
              actionTo="/workouts/new"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {exercises.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setSelected(selected === ex.id ? null : ex.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${selected === ex.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
                  style={{ minHeight: '44px' }}
                >
                  {tExerciseName(ex.id) || ex.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Time range */}
        {selected && (
          <div className="flex gap-2">
            {[30, 90, 180, 365].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors
                  ${days === d ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                {d}天
              </button>
            ))}
          </div>
        )}

        {/* Charts */}
        {selected && loading && <LoadingSpinner text="加载统计数据..." />}

        {selected && chartData && !loading && (
          <div className="space-y-6">
            {/* 1RM Trend */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                1RM 趋势 (Epley: 1RM = weight × (1 + reps/30))
              </h3>
              {chartData.oneRm.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">暂无满足计算条件的数据 (reps ≥ 2)</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData.oneRm}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(55,65,81)" />
                    <XAxis dataKey="date" stroke="rgb(107,114,128)" tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }} />
                    <YAxis stroke="rgb(107,114,128)" tick={{ fontSize: 11 }}
                      label={{ value: 'kg', position: 'insideLeft', style: { fill: 'rgb(107,114,128)', fontSize: 11 } }} />
                    <Tooltip
                      contentStyle={{ background: 'rgb(17,24,39)', border: '1px solid rgb(55,65,81)', borderRadius: '8px' }}
                      labelStyle={{ color: 'white' }}
                      formatter={(v) => [`${Number(v).toFixed(1)} kg`, '1RM']}
                    />
                    <Line type="monotone" dataKey="max1rm" stroke="rgb(52,211,153)" strokeWidth={2}
                      dot={{ r: 3, fill: 'rgb(52,211,153)' }} name="1RM" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Rest Time */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">平均组间休息 (秒)</h3>
              {chartData.restTime.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">暂无组间休息数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData.restTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(55,65,81)" />
                    <XAxis dataKey="date" stroke="rgb(107,114,128)" tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }} />
                    <YAxis stroke="rgb(107,114,128)" tick={{ fontSize: 11 }}
                      label={{ value: 'sec', position: 'insideLeft', style: { fill: 'rgb(107,114,128)', fontSize: 11 } }} />
                    <Tooltip
                      contentStyle={{ background: 'rgb(17,24,39)', border: '1px solid rgb(55,65,81)', borderRadius: '8px' }}
                      labelStyle={{ color: 'white' }}
                      formatter={(v) => [`${v}s`, '平均休息']}
                    />
                    <Bar dataKey="avgRestSec" fill="rgb(96,165,250)" radius={[2, 2, 0, 0]} name="平均休息" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="最佳 1RM" value={chartData.best1rm ? `${Number(chartData.best1rm).toFixed(1)} kg` : '--'} />
              <StatCard label="总训练次数" value={chartData.totalWorkouts || 0} />
              <StatCard label="总组数" value={chartData.totalSets || 0} />
            </div>
          </div>
        )}
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
