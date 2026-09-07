export function ProjectProgress({
  percent,
  showLabel = true,
  done,
  total,
}: {
  percent: number;
  showLabel?: boolean;
  /** Optional "X / Y tareas" count shown alongside the bar. */
  done?: number;
  total?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const tone = clamped >= 100 ? 'progress-green' : clamped >= 50 ? 'progress-blue' : 'progress-amber';
  return (
    <div>
      {total != null && (
        <div className="flex justify-between mb-2">
          <span className="progress-count">
            {done ?? 0} / {total} tareas
          </span>
        </div>
      )}
      <div className="progress-row">
        <div className="progress-bar-track">
          <div className={`progress-bar-fill ${tone}`} style={{ width: `${clamped}%` }} />
        </div>
        {showLabel && <span className="progress-label">{clamped}%</span>}
      </div>
    </div>
  );
}

export function computeProgress(tasks: { status: string }[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  return Math.round((done / tasks.length) * 100);
}
