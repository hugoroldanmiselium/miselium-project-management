import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { LoadingState, ErrorState } from './States';
import { TaskItem } from './TaskItem';
import { RecurringOccurrenceItem } from './RecurringOccurrenceItem';
import { TaskDetailModal } from './TaskDetailModal';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchClients, fetchOccurrencesInRange, fetchProfiles, fetchProjects, fetchRecurringTasks, fetchTasks, setOccurrenceStatus } from '../lib/queries';
import { WEEKDAY_LABELS, addDays, formatShortDate, startOfWeek, todayDateStr, weekDates, weekdayOf } from '../lib/recurringDates';
import { buildWeekOccurrences, occurrencesForDate } from '../lib/occurrences';
import type { OccurrenceStatus, Task } from '../types/database';

export function WeeklyCalendar() {
  const { profile } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const { data: tasks, loading: loadingTasks, error: errorTasks, refetch: refetchTasks } = useSupabaseQuery(() => fetchTasks());
  const { data: recurringTasks, loading: loadingRt, error: errorRt } = useSupabaseQuery(() => fetchRecurringTasks());
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());
  const { data: projects } = useSupabaseQuery(() => fetchProjects());
  const { data: clients } = useSupabaseQuery(() => fetchClients());

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const recurringTaskIds = useMemo(() => (recurringTasks ?? []).map((r) => r.id), [recurringTasks]);
  const { data: occurrenceRows, refetch: refetchOccurrences } = useSupabaseQuery(
    () => fetchOccurrencesInRange(recurringTaskIds, weekStart, weekEnd),
    [recurringTaskIds.join(','), weekStart]
  );

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);
  const profileMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p.name])), [profiles]);
  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients]);

  const weekViews = useMemo(
    () => buildWeekOccurrences(recurringTasks ?? [], occurrenceRows ?? [], weekStart),
    [recurringTasks, occurrenceRows, weekStart]
  );

  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const today = todayDateStr();

  async function handleOccurrenceStatusChange(recurringTaskId: string, date: string, status: OccurrenceStatus) {
    await setOccurrenceStatus({
      recurring_task_id: recurringTaskId,
      occurrence_date: date,
      status,
      completed_at: status === 'DONE' ? new Date().toISOString() : null,
      completed_by: status === 'DONE' ? profile?.id ?? null : null,
    });
    refetchOccurrences();
  }

  const loading = loadingTasks || loadingRt;
  const error = errorTasks || errorRt;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: 18 }}>Calendario semanal</h2>
          <p className="text-secondary mt-1">
            Semana del {formatShortDate(weekStart)} al {formatShortDate(weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<ChevronLeft size={14} />} onClick={() => setWeekStart(addDays(weekStart, -7))}>
            Anterior
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek())}>
            Hoy
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Siguiente
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {loading && <LoadingState label="Cargando calendario..." />}
      {!loading && error && <ErrorState description={error} />}
      {!loading && !error && (
        <div className="week-grid">
          {days.map((date) => {
            const dayTasks = (tasks ?? []).filter((t) => t.due_date === date);
            const dayOccurrences = occurrencesForDate(weekViews, date);
            const isToday = date === today;
            return (
              <div key={date} className={`week-day ${isToday ? 'week-day-today' : ''}`}>
                <div className="week-day-header">
                  <span>{WEEKDAY_LABELS[weekdayOf(date)]}</span>
                  <span className="text-small text-muted">{formatShortDate(date)}</span>
                </div>
                {dayTasks.length === 0 && dayOccurrences.length === 0 ? (
                  <div className="text-small text-muted" style={{ padding: '8px 4px' }}>
                    Sin actividades
                  </div>
                ) : (
                  <div className="week-day-items">
                    {dayTasks.map((t) => (
                      <TaskItem
                        key={t.id}
                        task={t}
                        projectName={projectMap.get(t.project_id)}
                        assigneeName={t.assigned_to ? profileMap.get(t.assigned_to) : undefined}
                        showProject
                        onClick={() => setActiveTask(t)}
                      />
                    ))}
                    {dayOccurrences.map((v) => (
                      <RecurringOccurrenceItem
                        key={`${v.recurringTask.id}-${v.date}`}
                        view={v}
                        projectName={v.recurringTask.project_id ? projectMap.get(v.recurringTask.project_id) : undefined}
                        clientName={v.recurringTask.client_id ? clientMap.get(v.recurringTask.client_id) : undefined}
                        onStatusChange={(status) => handleOccurrenceStatusChange(v.recurringTask.id, v.date, status)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailModal
        open={!!activeTask}
        onClose={() => setActiveTask(null)}
        task={activeTask}
        projectName={activeTask ? projectMap.get(activeTask.project_id) : undefined}
        assigneeName={activeTask?.assigned_to ? profileMap.get(activeTask.assigned_to) : undefined}
        profiles={profiles ?? []}
        onChanged={refetchTasks}
      />
    </div>
  );
}
