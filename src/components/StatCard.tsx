import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
  /** Optional accent line (Miselium's signature detail) for KPIs that
   * warrant visual emphasis — purely presentational, never implies a new
   * calculation. */
  accent?: 'green' | 'blue' | 'amber' | 'red' | 'purple';
}

export function StatCard({ label, value, delta, icon, accent }: StatCardProps) {
  const classes = ['stat-card', accent ? `accent-line accent-${accent}` : ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <div className="stat-card-label">
        {icon}
        {label}
      </div>
      <div className="stat-card-value">{value}</div>
      {delta && <div className="stat-card-delta">{delta}</div>}
    </div>
  );
}
