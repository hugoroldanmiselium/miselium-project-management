import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchProjects, fetchTasksForUser, updateTaskStatus } from '../lib/queries';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { TaskItem } from '../components/TaskItem';
import { taskStatusLabel } from '../components/Badge';
import type { TaskStatus } from '../types/database';

export function Today() {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');

  const { data: tasks, loading, error, refetch } = useSupabaseQuery(
    () => fetchTasksForUser(profile!.id),
    [profile?.id]
  );
  const { data: projects } = useSupabaseQuery(() => fetchProjects());
  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);

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
              onStatusChange={(status) => handleStatusChange(t.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
