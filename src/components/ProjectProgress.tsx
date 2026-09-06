export function ProjectProgress({ percent, showLabel = true }: { percent: number; showLabel?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-row">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && <span className="progress-label">{clamped}%</span>}
    </div>
  );
}

export function computeProgress(tasks: { status: string }[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  return Math.round((done / tasks.length) * 100);
}
