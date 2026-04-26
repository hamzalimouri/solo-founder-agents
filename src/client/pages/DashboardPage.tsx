import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DollarSign, Zap, Hash, TrendingUp } from 'lucide-react';
import { api, type OverviewData } from '../api.js';
import StatCard from '../components/StatCard.js';
import { fmtCost, fmtTokens, pctChange, timeAgo } from '../utils/format.js';

const AGENT_COLORS: Record<string, string> = {
  engineer: '#6366f1',
  research: '#06b6d4',
  content: '#f59e0b',
};
const PERIODS = [7, 14, 30] as const;

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    api.analytics.overview(period).then(setData).catch(console.error);
  }, [period]);

  if (!data) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-[#1c1c20] rounded animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-5 h-28 animate-pulse bg-[#1c1c20]" />
          ))}
        </div>
      </div>
    );
  }

  const spendChange = pctChange(data.totalSpend, data.yesterdaySpend);
  const reqChange = pctChange(data.totalRequests, data.yesterdayRequests);

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-[#a1a1aa] mt-0.5">Your AI team performance today</p>
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Spent Today"
          value={fmtCost(data.totalSpend)}
          pct={spendChange.pct}
          up={!spendChange.up}
          sub="vs yesterday"
          icon={<DollarSign size={16} />}
        />
        <StatCard
          label="Requests"
          value={String(data.totalRequests)}
          pct={reqChange.pct}
          up={reqChange.up}
          sub="vs yesterday"
          icon={<Hash size={16} />}
        />
        <StatCard
          label="Tokens Used"
          value={fmtTokens(data.totalTokens)}
          sub={`last ${period} days`}
          icon={<Zap size={16} />}
        />
        <StatCard
          label="Avg Cost / Req"
          value={fmtCost(data.averageCostPerRequest)}
          sub={`last ${period} days`}
          icon={<TrendingUp size={16} />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Spend over time */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4">Spend Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.spendByDay}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" />
              <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
              <Tooltip
                contentStyle={{ background: '#141416', border: '1px solid #2a2a2e', borderRadius: 8 }}
                labelStyle={{ color: '#e4e4e7' }}
                formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']}
              />
              <Area type="monotone" dataKey="cost" stroke="#6366f1" fill="url(#grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Agent donut */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">By Agent</h2>
          {data.spendByAgent.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.spendByAgent}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  dataKey="cost"
                  nameKey="agent_key"
                >
                  {data.spendByAgent.map((entry) => (
                    <Cell key={entry.agent_key} fill={AGENT_COLORS[entry.agent_key] ?? '#6366f1'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#141416', border: '1px solid #2a2a2e', borderRadius: 8 }}
                  formatter={(v: number, _: unknown, p: { payload?: { emoji?: string; name?: string } }) =>
                    [`$${v.toFixed(4)}`, `${p.payload?.emoji ?? ''} ${p.payload?.name ?? ''}`]
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-[#52525b] text-sm">No data yet</div>
          )}
          <div className="space-y-1.5 mt-2">
            {data.spendByAgent.map((a) => (
              <div key={a.agent_key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: AGENT_COLORS[a.agent_key] ?? '#6366f1' }} />
                  <span className="text-[#a1a1aa]">{a.emoji} {a.name}</span>
                </div>
                <span className="text-white font-medium">{fmtCost(a.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Most Expensive Queries</h2>
        {data.topQueries.length === 0 ? (
          <p className="text-sm text-[#52525b]">No activity yet. Send a message to your bot on Telegram or use the Chat page.</p>
        ) : (
          <div className="space-y-2">
            {data.topQueries.map((q, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#2a2a2e] last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg flex-shrink-0">
                    {AGENT_COLORS[q.agent_key] ? (q.agent_key === 'engineer' ? '🛠' : q.agent_key === 'research' ? '🔍' : '✍️') : '🤖'}
                  </span>
                  <span className="text-sm text-[#e4e4e7] truncate">{q.user_message}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-xs text-[#52525b]">{timeAgo(q.created_at)}</span>
                  <span className="text-xs font-medium text-[#f59e0b]">{fmtCost(q.cost_usd)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
