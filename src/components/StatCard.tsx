import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, delta, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">
        {icon}
        {label}
      </div>
      <div className="stat-card-value">{value}</div>
      {delta && <div className="stat-card-delta">{delta}</div>}
    </div>
  );
}
