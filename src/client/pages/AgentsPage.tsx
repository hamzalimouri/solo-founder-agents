import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Clock, DollarSign, Zap } from 'lucide-react';
import { api, type AgentStat } from '../api.js';
import { fmtCost, fmtTokens, fmtMs } from '../utils/format.js';

const PERIODS = [7, 14, 30] as const;
const AGENT_COLORS: Record<string, string> = {
  engineer: '#6366f1', research: '#06b6d4', content: '#f59e0b',
};

export default function AgentsPage() {
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [metric, setMetric] = useState<'requests' | 'cost' | 'tokens'>('requests');
  const navigate = useNavigate();

  useEffect(() => {
    api.analytics.agents(period).then(setStats).catch(console.error);
  }, [period]);

  const comparisonData = stats.map((a) => ({
    name: `${a.emoji} ${a.name.split(' ')[0]}`,
    requests: a.totalRequests,
    cost: parseFloat(a.totalCost.toFixed(4)),
    tokens: a.totalTokens,
    key: a.key,
  }));

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">Per-agent performance breakdown</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#141416] border border-[#2a2a2e] rounded-lg p-1">
            {(['requests', 'cost', 'tokens'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                  metric === m ? 'bg-[#6366f1] text-white' : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-[#141416] border border-[#2a2a2e] rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  period === p ? 'bg-[#6366f1] text-white' : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison chart */}
      {comparisonData.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Agent Comparison</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" />
              <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#141416', border: '1px solid #2a2a2e', borderRadius: 8 }}
                labelStyle={{ color: '#e4e4e7' }}
              />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                {comparisonData.map((d) => (
                  <rect key={d.key} fill={AGENT_COLORS[d.key] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-agent cards */}
      <div className="space-y-4">
        {stats.length === 0 ? (
          <div className="card p-8 text-center text-[#52525b] text-sm">
            No agent data yet. Start chatting to see performance stats.
          </div>
        ) : (
          stats.map((agent) => (
            <div key={agent.key} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: `${AGENT_COLORS[agent.key]}20` }}
                  >
                    {agent.emoji}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">{agent.name}</div>
                    <div className="text-xs text-[#a1a1aa]">Last {period} days</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/chat')}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  Chat →
                </button>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Requests', value: String(agent.totalRequests), icon: <MessageSquare size={14} /> },
                  { label: 'Total Cost', value: fmtCost(agent.totalCost), icon: <DollarSign size={14} /> },
                  { label: 'Avg Response', value: fmtMs(agent.avgDurationMs), icon: <Clock size={14} /> },
                  { label: 'Avg Tokens', value: fmtTokens(agent.avgInputTokens + agent.avgOutputTokens), icon: <Zap size={14} /> },
                ].map((m) => (
                  <div key={m.label} className="bg-[#1c1c20] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[#a1a1aa] text-xs mb-1">
                      {m.icon}
                      {m.label}
                    </div>
                    <div className="text-base font-semibold text-white">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Sparkline */}
              {agent.dailyUsage.length > 1 && (
                <div className="mb-4">
                  <div className="text-xs text-[#a1a1aa] mb-2">Daily requests</div>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={agent.dailyUsage}>
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke={AGENT_COLORS[agent.key] ?? '#6366f1'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top queries */}
              {agent.topQueries.length > 0 && (
                <div>
                  <div className="text-xs text-[#a1a1aa] mb-2">Top queries by cost</div>
                  <div className="space-y-1">
                    {agent.topQueries.map((q, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm text-[#e4e4e7] truncate mr-4">• {q.message}</span>
                        <span className="text-xs text-[#f59e0b] flex-shrink-0">{fmtCost(q.cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
