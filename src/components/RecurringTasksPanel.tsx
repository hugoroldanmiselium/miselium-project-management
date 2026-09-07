import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './Button';
import { Table, type Column } from './Table';
import { Modal } from './Modal';
import { LoadingState, ErrorState, EmptyState } from './States';
import { Badge, priorityColor, priorityLabel } from './Badge';
import { RecurringTaskFormModal, type RecurringTaskFormValues } from './forms/RecurringTaskFormModal';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import {
  createRecurringTask,
  deleteRecurringTask,
  fetchClients,
  fetchOccurrenceHistory,
  fetchOccurrencesInRange,
  fetchProfiles,
  fetchProjects,
  fetchRecurringTasks,
  updateRecurringTask,
} from '../lib/queries';
import { WEEKDAY_LABELS, addDays, nextOccurrenceDate, startOfWeek, todayDateStr } from '../lib/recurringDates';
import { buildWeekOccurrences } from '../lib/occurrences';
import type { RecurringTask } from '../types/database';

export function RecurringTasksPanel() {
  const { canManage, profile } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<RecurringTask | null>(null);

  const { data: recurringTasks, loading, error, refetch } = useSupabaseQuery(() => fetchRecurringTasks());
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());
  const { data: clients } = useSupabaseQuery(() => fetchClients());
  const { data: projects } = useSupabaseQuery(() => fetchProjects());

  const profileMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p.name])), [profiles]);

  const thisWeekStart = useMemo(() => startOfWeek(), []);
  const thisWeekEnd = useMemo(() => addDays(thisWeekStart, 6), [thisWeekStart]);
  const recurringTaskIds = useMemo(() => (recurringTasks ?? []).map((r) => r.id), [recurringTasks]);
  const { data: weekOccurrenceRows } = useSupabaseQuery(
    () => fetchOccurrencesInRange(recurringTaskIds, thisWeekStart, thisWeekEnd),
    [recurringTaskIds.join(','), thisWeekStart]
  );

  const weekViews = useMemo(
    () => buildWeekOccurrences(recurringTasks ?? [], weekOccurrenceRows ?? [], thisWeekStart),
    [recurringTasks, weekOccurrenceRows, thisWeekStart]
  );

  const metrics = useMemo(() => {
    const total = weekViews.length;
    const completed = weekViews.filter((v) => v.status === 'DONE').length;
    const skipped = weekViews.filter((v) => v.status === 'SKIPPED').length;
    const pending = weekViews.filter((v) => v.status === 'PENDING' || v.status === 'IN_PROGRESS').length;
    const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, skipped, pending, compliance };
  }, [weekViews]);

  const weekStatusByTask = useMemo(() => {
    const map = new Map<string, string>();
    weekViews.forEach((v) => map.set(v.recurringTask.id, v.status));
    return map;
  }, [weekViews]);

  async function handleCreate(values: RecurringTaskFormValues) {
    if (!profile) return;
    setSubmitting(true);
    await createRecurringTask({ ...values, organization_id: profile.organization_id, created_by: profile.id });
    setSubmitting(false);
    setModalOpen(false);
    refetch();
  }

  async function handleEdit(values: RecurringTaskFormValues) {
    if (!editingTask) return;
    setSubmitting(true);
    await updateRecurringTask(editingTask.id, values);
    setSubmitting(false);
    setEditingTask(null);
    refetch();
  }

  async function handleTogglePause(task: RecurringTask) {
    await updateRecurringTask(task.id, { active: !task.active });
    refetch();
  }

  // "Eliminar solo futuras ocurrencias": sets end_date to yesterday so the
  // recurrence stops producing new occurrences going forward, WITHOUT
  // deleting any persisted recurring_task_occurrences history rows. See
  // 010_recurring_tasks.sql for why this is the chosen implementation.
  async function handleDeleteFutureOnly() {
    if (!deleteTarget) return;
    setDeleting(true);
    // end_date must be >= start_date (DB check constraint) - if the
    // recurrence's start_date is today or in the future, "yesterday" would
    // violate that, so clamp to start_date instead. Either way `active:
    // false` stops it from producing any further occurrences immediately.
    const yesterday = addDays(todayDateStr(), -1);
    const endDate = yesterday < deleteTarget.start_date ? deleteTarget.start_date : yesterday;
    await updateRecurringTask(deleteTarget.id, { end_date: endDate, active: false });
    setDeleting(false);
    setDeleteTarget(null);
    refetch();
  }

  async function handleDeleteCompletely() {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteRecurringTask(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    refetch();
  }

  const columns: Column<RecurringTask>[] = [
    { header: 'Nombre', key: 'name', render: (t) => <span style={{ fontWeight: 500 }}>{t.name}</span> },
    { header: 'Responsable', key: 'assignee', render: (t) => (t.assignee_id ? profileMap.get(t.assignee_id) ?? '—' : 'Sin asignar') },
    { header: 'Dia', key: 'weekday', render: (t) => WEEKDAY_LABELS[t.weekday] },
    { header: 'Hora', key: 'time', render: (t) => t.time_of_day?.slice(0, 5) ?? '—' },
    { header: 'Horas', key: 'hours', render: (t) => (t.estimated_hours != null ? `${t.estimated_hours}h` : '—') },
    {
      header: 'Prioridad',
      key: 'priority',
      render: (t) => <Badge color={priorityColor(t.priority)}>{priorityLabel(t.priority)}</Badge>,
    },
    {
      header: 'Estado esta semana',
      key: 'weekStatus',
      render: (t) => {
        const s = weekStatusByTask.get(t.id);
        if (!t.active) return <span className="text-small text-muted">—</span>;
        if (!s) return <span className="text-small text-muted">—</span>;
        return <Badge color={s === 'DONE' ? 'green' : s === 'SKIPPED' ? 'gray' : s === 'IN_PROGRESS' ? 'yellow' : 'blue'}>{s === 'DONE' ? 'Completada' : s === 'SKIPPED' ? 'Omitida' : s === 'IN_PROGRESS' ? 'En progreso' : 'Pendiente'}</Badge>;
      },
    },
    {
      header: 'Proxima ocurrencia',
      key: 'next',
      render: (t) => nextOccurrenceDate(t) ?? '—',
    },
    {
      header: 'Activa',
      key: 'active',
      render: (t) => <Badge color={t.active ? 'green' : 'gray'}>{t.active ? 'Activa' : 'Pausada'}</Badge>,
    },
    {
      header: 'Acciones',
      key: 'actions',
      render: (t) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-secondary btn-sm" onClick={() => setHistoryTarget(t)}>
            Historial
          </button>
          {canManage && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingTask(t)}>
                Editar
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleTogglePause(t)}>
                {t.active ? 'Pausar' : 'Reactivar'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(t)}>
                Eliminar
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: 18 }}>Tareas recurrentes</h2>
          <p className="text-secondary mt-1">Actividades operativas que se repiten cada semana.</p>
        </div>
        {canManage && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Nueva tarea recurrente
          </Button>
        )}
      </div>

      {!loading && !error && (recurringTasks ?? []).length > 0 && (
        <div className="stat-grid mb-6">
          <MetricCard label="Esta semana" value={metrics.total} />
          <MetricCard label="Completadas" value={metrics.completed} />
          <MetricCard label="Pendientes" value={metrics.pending} />
          <MetricCard label="Omitidas" value={metrics.skipped} />
          <MetricCard label="Cumplimiento" value={`${metrics.compliance}%`} />
        </div>
      )}

      {loading && <LoadingState label="Cargando tareas recurrentes..." />}
      {!loading && error && <ErrorState description={error} onRetry={refetch} />}
      {!loading && !error && (recurringTasks ?? []).length === 0 && (
        <EmptyState title="Sin tareas recurrentes" description="Aun no se ha configurado ninguna tarea recurrente semanal." />
      )}
      {!loading && !error && (recurringTasks ?? []).length > 0 && (
        <Table columns={columns} rows={recurringTasks ?? []} rowKey={(t) => t.id} />
      )}

      <RecurringTaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        profiles={profiles ?? []}
        clients={clients ?? []}
        projects={projects ?? []}
        submitting={submitting}
      />
      <RecurringTaskFormModal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleEdit}
        profiles={profiles ?? []}
        clients={clients ?? []}
        projects={projects ?? []}
        initialTask={editingTask}
        submitting={submitting}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar tarea recurrente"
        maxWidth={440}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleDeleteFutureOnly} loading={deleting}>
              Solo futuras ocurrencias
            </Button>
            <Button variant="danger" onClick={handleDeleteCompletely} loading={deleting}>
              Eliminar completamente
            </Button>
          </>
        }
      >
        <p className="text-body text-secondary">
          ¿Que deseas hacer con <strong>{deleteTarget?.name}</strong>?
        </p>
        <p className="text-small text-muted mt-2">
          <strong>Solo futuras ocurrencias:</strong> deja de generar nuevas ocurrencias a partir de hoy, pero conserva el
          historial de ocurrencias pasadas.
        </p>
        <p className="text-small text-muted mt-2">
          <strong>Eliminar completamente:</strong> borra la recurrencia y todo su historial de ocurrencias de forma
          permanente.
        </p>
      </Modal>

      <OccurrenceHistoryModal task={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card card-padded">
      <div className="text-small text-muted">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function OccurrenceHistoryModal({ task, onClose }: { task: RecurringTask | null; onClose: () => void }) {
  const { data: history, loading } = useSupabaseQuery(
    () => (task ? fetchOccurrenceHistory(task.id) : Promise.resolve({ data: [], error: null })),
    [task?.id]
  );

  return (
    <Modal open={!!task} onClose={onClose} title={`Historial - ${task?.name ?? ''}`} maxWidth={480}>
      {loading && <LoadingState label="Cargando historial..." />}
      {!loading && (history ?? []).length === 0 && (
        <EmptyState title="Sin historial" description="Esta tarea recurrente aun no tiene ocurrencias registradas." />
      )}
      {!loading &&
        (history ?? []).map((h) => (
          <div key={h.id} className="info-row">
            <span className="info-row-label">{h.occurrence_date}</span>
            <Badge color={h.status === 'DONE' ? 'green' : h.status === 'SKIPPED' ? 'gray' : h.status === 'IN_PROGRESS' ? 'yellow' : 'blue'}>
              {h.status === 'DONE' ? 'Completada' : h.status === 'SKIPPED' ? 'Omitida' : h.status === 'IN_PROGRESS' ? 'En progreso' : 'Pendiente'}
            </Badge>
          </div>
        ))}
    </Modal>
  );
}
