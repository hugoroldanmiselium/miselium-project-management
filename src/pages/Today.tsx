import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchProfiles, fetchProjects, fetchTasksForUser, fetchTimeEntriesForTasks, updateTaskStatus } from '../lib/queries';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { TaskItem } from '../components/TaskItem';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { taskStatusLabel } from '../components/Badge';
import type { Task, TaskStatus } from '../types/database';

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
