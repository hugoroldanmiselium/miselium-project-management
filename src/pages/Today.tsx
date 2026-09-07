import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import {
  fetchOccurrencesInRange,
  fetchProfiles,
  fetchProjects,
  fetchRecurringTasks,
  fetchTasksForUser,
  fetchTimeEntriesForTasks,
  setOccurrenceStatus,
  updateTaskStatus,
} from '../lib/queries';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { TaskItem } from '../components/TaskItem';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { RecurringOccurrenceItem } from '../components/RecurringOccurrenceItem';
import { taskStatusLabel } from '../components/Badge';
import { startOfWeek, todayDateStr } from '../lib/recurringDates';
import { buildWeekOccurrences, occurrencesForDate } from '../lib/occurrences';
import type { OccurrenceStatus, Task, TaskStatus } from '../types/database';

export function Today() {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const { data: tasks, loading, error, refetch } = useSupabaseQuery(
    () => fetchTasksForUser(profile!.id),
    [profile?.id]
  );
  const { data: projects } = useSupabaseQuery(() => fetchProjects());
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());
  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);
  const taskIds = useMemo(() => (tasks ?? []).map((t) => t.id), [tasks]);
  const { data: timeEntries, refetch: refetchTimeEntries } = useSupabaseQuery(
    () => fetchTimeEntriesForTasks(taskIds),
    [taskIds.join(',')]
  );
  const hoursByTask = useMemo(() => {
    const map = new Map<string, number>();
    (timeEntries ?? []).forEach((e) => map.set(e.task_id, (map.get(e.task_id) ?? 0) + Number(e.hours)));
    return map;
  }, [timeEntries]);

  // Today's recurring occurrences assigned to the current user - a separate
  // section from project tasks above, clearly labeled as recurring (see
  // RecurringOccurrenceItem's "↻ Recurrente" tag).
  const todayStr = todayDateStr();
  const weekStart = useMemo(() => startOfWeek(todayStr), [todayStr]);
  const { data: allRecurringTasks } = useSupabaseQuery(() => fetchRecurringTasks());
  const myRecurringTasks = useMemo(
    () => (allRecurringTasks ?? []).filter((rt) => rt.assignee_id === profile?.id && rt.active),
    [allRecurringTasks, profile?.id]
  );
  const myRecurringTaskIds = useMemo(() => myRecurringTasks.map((rt) => rt.id), [myRecurringTasks]);
  const { data: todayOccurrenceRows, refetch: refetchOccurrences } = useSupabaseQuery(
    () => fetchOccurrencesInRange(myRecurringTaskIds, todayStr, todayStr),
    [myRecurringTaskIds.join(','), todayStr]
  );
  const todayOccurrences = useMemo(() => {
    const views = buildWeekOccurrences(myRecurringTasks, todayOccurrenceRows ?? [], weekStart);
    return occurrencesForDate(views, todayStr);
  }, [myRecurringTasks, todayOccurrenceRows, weekStart, todayStr]);

  async function handleOccurrenceStatusChange(recurringTaskId: string, status: OccurrenceStatus) {
    await setOccurrenceStatus({
      recurring_task_id: recurringTaskId,
      occurrence_date: todayStr,
      status,
      completed_at: status === 'DONE' ? new Date().toISOString() : null,
      completed_by: status === 'DONE' ? profile?.id ?? null : null,
    });
    refetchOccurrences();
  }

  const filtered = useMemo(() => {
    if (!tasks) return [];
    if (statusFilter === 'ALL') return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    await updateTaskStatus(taskId, status);
    refetch();
  }

  const today = new Date();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Hoy</h1>
          <p className="text-secondary mt-1">
            {today.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      <div className="filter-bar">
        {(['ALL', 'TODO', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
          <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
            {s === 'ALL' ? 'Todas' : taskStatusLabel(s)}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Cargando tus tareas..." />}
      {!loading && error && <ErrorState description={error} onRetry={refetch} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="No tienes tareas" description="No hay tareas asignadas a ti con este filtro." />
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="card">
          {filtered.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              projectName={projectMap.get(t.project_id)}
              showProject
              loggedHours={hoursByTask.get(t.id)}
              onStatusChange={(status) => handleStatusChange(t.id, status)}
              onClick={() => setActiveTask(t)}
            />
          ))}
        </div>
      )}

      {todayOccurrences.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2" style={{ fontSize: 15 }}>
            Tareas recurrentes de hoy
          </h3>
          <div className="card">
            {todayOccurrences.map((v) => (
              <RecurringOccurrenceItem
                key={v.recurringTask.id}
                view={v}
                onStatusChange={(status) => handleOccurrenceStatusChange(v.recurringTask.id, status)}
              />
            ))}
          </div>
        </div>
      )}
      <TaskDetailModal
        open={!!activeTask}
        onClose={() => setActiveTask(null)}
        task={activeTask}
        projectName={activeTask ? projectMap.get(activeTask.project_id) : undefined}
        assigneeName={profile?.name}
        profiles={profiles ?? []}
        onChanged={() => {
          refetch();
          refetchTimeEntries();
        }}
      />
    </div>
  );
}
