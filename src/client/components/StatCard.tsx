import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  sub?: string;
  pct?: number;
  up?: boolean;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, sub, pct, up, icon }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">{label}</span>
        {icon && <span className="text-[#a1a1aa]">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {(sub || pct !== undefined) && (
        <div className="flex items-center gap-1.5 text-xs">
          {pct !== undefined && (
            <span className={`flex items-center gap-0.5 font-medium ${up ? 'text-green-500' : 'text-red-400'}`}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {pct.toFixed(1)}%
            </span>
          )}
          {sub && <span className="text-[#52525b]">{sub}</span>}
        </div>
      )}
    </div>
  );
}
