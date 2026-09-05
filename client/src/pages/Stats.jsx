import { useState, useEffect } from 'react';
import apiClient from '../api/client.js';
import { MUSCLE_LABELS } from '../constants/muscles.js';
import { tExerciseName, tMuscle } from '../utils/i18n.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

export default function Stats() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [exerciseChartData, setExerciseChartData] = useState(null);
  const [exerciseLoading, setExerciseLoading] = useState(false);

  // 1. 获取全局概览数据
  useEffect(() => {
    setOverviewLoading(true);
    apiClient.get('/stats/overview', { params: { days } })
      .then(({ data }) => setOverview(data.data))
      .catch(() => setOverview(null))
      .finally(() => setOverviewLoading(false));
  }, [days]);

  // 2. 获取使用过的动作列表
  useEffect(() => {
    apiClient.get('/stats/exercises-used')
      .then(({ data }) => setExercises(data.data || []))
      .catch(() => {});
  }, []);

  // 3. 获取特定动作的详细 1RM 与休息数据
  useEffect(() => {
    if (!selected) {
      setExerciseChartData(null);
      return;
    }
    setExerciseLoading(true);
    apiClient.get(`/stats/exercise/${selected}`, { params: { days } })
      .then(({ data }) => setExerciseChartData(data.data))
      .catch(() => setExerciseChartData(null))
      .finally(() => setExerciseLoading(false));
  }, [selected, days]);

  const hasWorkouts = overview && overview.totalWorkouts > 0;

  return (
    <div className="min-h-dvh pb-20 max-w-7xl mx-auto">
      {/* 头部与时间范围切换 */}
      <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">数据统计</h1>
        <div className="flex gap-1.5 bg-gray-900 p-1 rounded-xl border border-gray-800">
          {[7, 30, 90, 180].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors
                ${days === d ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              style={{ minHeight: '32px' }}
            >
              {d}天
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {overviewLoading ? (
          <LoadingSpinner text="正在聚合训练数据..." />
        ) : !hasWorkouts ? (
          <EmptyState
            icon="📊"
            title="还没有训练数据"
            description="完成一次训练后，这里将生成多维度训练容量与力量增长分析"
            actionLabel="开始第一次训练"
            actionTo="/workouts/new"
          />
        ) : (
          <>
            {/* 1. 全局概览看板卡片 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 tracking-wide">训练看板</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="总训练容量" value={`${overview.totalVolumeKg.toLocaleString()} kg`} highlight />
                <StatCard label="总训练次数" value={`${overview.totalWorkouts} 次`} />
                <StatCard label="累计训练时长" value={`${(overview.totalDurationMinutes / 60).toFixed(1)} 小时`} />
                <StatCard label="总组数 / 次数" value={`${overview.totalSets} 组 / ${overview.totalReps} 次`} />
              </div>
            </div>

            {/* 2. 训练容量走势 (Volume Trend) */}
            {overview.volumeTrend && overview.volumeTrend.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-200">训练容量走势 (kg)</h3>
                  <span className="text-xs text-gray-500">柱状图呈现每次训练量</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={overview.volumeTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(55,65,81)" />
                    <XAxis
                      dataKey="date"
                      stroke="rgb(107,114,128)"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis
                      stroke="rgb(107,114,128)"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'kg', position: 'insideLeft', style: { fill: 'rgb(107,114,128)', fontSize: 11 } }}
                    />
                    <Tooltip
                      contentStyle={{ background: 'rgb(17,24,39)', border: '1px solid rgb(55,65,81)', borderRadius: '8px' }}
                      labelStyle={{ color: 'white' }}
                      formatter={(v) => [`${Number(v).toLocaleString()} kg`, '单日容量']}
                    />
                    <Bar dataKey="volume" fill="rgb(52,211,153)" radius={[3, 3, 0, 0]} name="训练容量" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 3. 肌肉群训练分布 (Muscle Distribution) */}
            {overview.muscleDistribution && overview.muscleDistribution.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">肌群负荷分布</h3>
                <div className="space-y-3">
                  {overview.muscleDistribution.map(m => (
                    <div key={m.muscle} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-300 font-medium">{tMuscle(m.muscle)} ({MUSCLE_LABELS[m.muscle] || m.muscle})</span>
                        <span className="text-gray-400 font-mono">{m.sets} 组 · {m.percentage}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${m.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. 单动作微观进阶分析 */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-400 tracking-wide">动作力量进阶 (1RM & 组间休息)</h2>
                {selected && (
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    收起分析
                  </button>
                )}
              </div>

              {/* 动作选择器按钮组 */}
              <div data-testid="exercise-buttons" className="flex flex-wrap gap-2 mb-4">
                {exercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => setSelected(selected === ex.id ? null : ex.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                      ${selected === ex.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
                    style={{ minHeight: '40px' }}
                  >
                    {tExerciseName(ex.id, ex.name) || ex.name}
                  </button>
                ))}
              </div>

              {selected && exerciseLoading && <LoadingSpinner text="加载动作力量曲线..." />}

              {selected && exerciseChartData && !exerciseLoading && (
                <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
                  {/* 1RM 渐进折线图 */}
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2">
                      1RM 力量曲线 (Epley 公式计算)
                    </h3>
                    {exerciseChartData.oneRm.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-8">暂无满足计算条件的数据 (需组次数 reps ≥ 2)</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={exerciseChartData.oneRm}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgb(55,65,81)" />
                          <XAxis
                            dataKey="date"
                            stroke="rgb(107,114,128)"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              const d = new Date(v);
                              return `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                          />
                          <YAxis
                            stroke="rgb(107,114,128)"
                            tick={{ fontSize: 11 }}
                            label={{ value: 'kg', position: 'insideLeft', style: { fill: 'rgb(107,114,128)', fontSize: 11 } }}
                          />
                          <Tooltip
                            contentStyle={{ background: 'rgb(17,24,39)', border: '1px solid rgb(55,65,81)', borderRadius: '8px' }}
                            labelStyle={{ color: 'white' }}
                            formatter={(v) => [`${Number(v).toFixed(1)} kg`, '预估 1RM']}
                          />
                          <Line
                            type="monotone"
                            dataKey="max1rm"
                            stroke="rgb(52,211,153)"
                            strokeWidth={2.5}
                            dot={{ r: 3.5, fill: 'rgb(52,211,153)' }}
                            name="1RM"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* 组间休息时长柱状图 */}
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2">平均组间休息 (秒)</h3>
                    {exerciseChartData.restTime.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-8">暂无组间休息数据</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={exerciseChartData.restTime}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgb(55,65,81)" />
                          <XAxis
                            dataKey="date"
                            stroke="rgb(107,114,128)"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              const d = new Date(v);
                              return `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                          />
                          <YAxis
                            stroke="rgb(107,114,128)"
                            tick={{ fontSize: 11 }}
                            label={{ value: 'sec', position: 'insideLeft', style: { fill: 'rgb(107,114,128)', fontSize: 11 } }}
                          />
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

                  {/* 动作汇总指标 */}
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="历史最佳 1RM" value={exerciseChartData.best1rm ? `${exerciseChartData.best1rm} kg` : '--'} highlight />
                    <StatCard label="该动作训练次数" value={`${exerciseChartData.totalWorkouts || 0} 次`} />
                    <StatCard label="累计完成组数" value={`${exerciseChartData.totalSets || 0} 组`} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3.5 text-center border border-gray-800">
      <p className={`text-xl font-extrabold truncate ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
