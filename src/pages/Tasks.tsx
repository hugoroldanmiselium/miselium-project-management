import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { Table, type Column } from '../components/Table';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Badge, isOverdue, priorityColor, priorityLabel, taskStatusColor, taskStatusLabel } from '../components/Badge';
import { TaskFormModal } from '../components/forms/TaskFormModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { RecurringTasksPanel } from '../components/RecurringTasksPanel';
import { WeeklyCalendar } from '../components/WeeklyCalendar';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { createTask, fetchProfiles, fetchProjects, fetchTasks, logActivity, updateTaskStatus } from '../lib/queries';
import type { Task, TaskStatus } from '../types/database';

type TasksTab = 'list' | 'recurring' | 'calendar';

export function Tasks() {
  const { canManage, profile } = useAuth();
  const [tab, setTab] = useState<TasksTab>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const { data: tasks, loading, error, refetch } = useSupabaseQuery(() => fetchTasks());
  const { data: projects } = useSupabaseQuery(() => fetchProjects());
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);
  const profileMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p.name])), [profiles]);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    if (statusFilter === 'ALL') return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  async function handleCreate(values: Parameters<typeof createTask>[0]) {
    setSubmitting(true);
    const { data } = await createTask(values);
    setSubmitting(false);
    if (data && profile) {
      await logActivity(profile.id, data.project_id, `Creo la tarea "${data.title}"`);
    }
    setModalOpen(false);
    refetch();
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    await updateTaskStatus(taskId, status);
    refetch();
  }

  const columns: Column<Task>[] = [
    { header: 'Tarea', key: 'title', render: (t) => <span style={{ fontWeight: 500 }}>{t.title}</span> },
    { header: 'Proyecto', key: 'project', render: (t) => projectMap.get(t.project_id) ?? '—' },
    { header: 'Asignado a', key: 'assignee', render: (t) => (t.assigned_to ? profileMap.get(t.assigned_to) ?? '—' : 'Sin asignar') },
    {
      header: 'Prioridad',
      key: 'priority',
      render: (t) => <Badge color={priorityColor(t.priority)}>{priorityLabel(t.priority)}</Badge>,
    },
    { header: 'Fecha limite', key: 'due', render: (t) => t.due_date ?? '—' },
    { header: 'Estimación', key: 'estimated', render: (t) => (t.estimated_hours != null ? `${t.estimated_hours} h` : '—') },
    {
      header: 'Estado',
      key: 'status',
      render: (t) => {
        const canEdit = canManage || t.assigned_to === profile?.id;
        if (!canEdit) {
          return isOverdue(t.due_date, t.status) ? (
            <Badge color="red">Vencida</Badge>
          ) : (
            <Badge color={taskStatusColor(t.status)}>{taskStatusLabel(t.status)}</Badge>
          );
        }
        return (
          <select
            className="select-inline"
            value={t.status}
            onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="TODO">Pendiente</option>
            <option value="IN_PROGRESS">En progreso</option>
            <option value="DONE">Completada</option>
          </select>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tareas</h1>
          <p className="text-secondary mt-1">Todas las tareas visibles para tu rol.</p>
        </div>
        {tab === 'list' && canManage && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Nueva tarea
          </Button>
        )}
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          Lista
        </div>
        <div className={`tab ${tab === 'recurring' ? 'active' : ''}`} onClick={() => setTab('recurring')}>
          Tareas recurrentes
        </div>
        <div className={`tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>
          Calendario semanal
        </div>
      </div>

      {tab === 'list' && (
        <>
          <div className="filter-bar">
            {(['ALL', 'TODO', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
              <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === 'ALL' ? 'Todas' : taskStatusLabel(s)}
              </button>
            ))}
          </div>

          {loading && <LoadingState label="Cargando tareas..." />}
          {!loading && error && <ErrorState description={error} onRetry={refetch} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState title="Sin tareas" description="No hay tareas que coincidan con este filtro." />
          )}
          {!loading && !error && filtered.length > 0 && (
            <Table columns={columns} rows={filtered} rowKey={(t) => t.id} onRowClick={(t) => setActiveTask(t)} />
          )}

          <TaskFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSubmit={handleCreate}
            projects={projects ?? []}
            profiles={profiles ?? []}
            submitting={submitting}
          />
          <TaskDetailModal
            open={!!activeTask}
            onClose={() => setActiveTask(null)}
            task={activeTask}
            projectName={activeTask ? projectMap.get(activeTask.project_id) : undefined}
            assigneeName={activeTask ? profileMap.get(activeTask.assigned_to ?? '') : undefined}
            profiles={profiles ?? []}
            onChanged={refetch}
          />
        </>
      )}

      {tab === 'recurring' && <RecurringTasksPanel />}
      {tab === 'calendar' && <WeeklyCalendar />}
    </div>
  );
}
