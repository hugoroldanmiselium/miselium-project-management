import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import {
  addProjectMember,
  createTask,
  deleteProject,
  fetchActivityForProject,
  fetchClients,
  fetchProfiles,
  fetchProject,
  fetchProjectMembers,
  fetchTasksForProject,
  logActivity,
  removeProjectMember,
  updateProject,
  updateTaskStatus,
} from '../lib/queries';
import { LoadingState, ErrorState, NotFoundState, EmptyState } from '../components/States';
import { Badge, projectStatusColor, projectStatusLabel } from '../components/Badge';
import { ProjectProgress, computeProgress } from '../components/ProjectProgress';
import { TaskItem } from '../components/TaskItem';
import { Button } from '../components/Button';
import { Select } from '../components/Input';
import { ProjectFormModal } from '../components/forms/ProjectFormModal';
import { TaskFormModal } from '../components/forms/TaskFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { TaskStatus } from '../types/database';

type Tab = 'tasks' | 'team' | 'activity';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('tasks');
  const [editOpen, setEditOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: project, loading, error, refetch } = useSupabaseQuery(() => fetchProject(id!), [id]);
  const { data: clients } = useSupabaseQuery(() => fetchClients());
  const { data: tasks, refetch: refetchTasks } = useSupabaseQuery(() => fetchTasksForProject(id!), [id]);
  const { data: members, refetch: refetchMembers } = useSupabaseQuery(() => fetchProjectMembers(id!), [id]);
  const { data: activity } = useSupabaseQuery(() => fetchActivityForProject(id!), [id, tab]);
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());

  const clientName = useMemo(
    () => clients?.find((c) => c.id === project?.client_id)?.name,
    [clients, project]
  );
  const memberProfiles = useMemo(
    () => (profiles ?? []).filter((p) => (members ?? []).some((m) => m.user_id === p.id)),
    [profiles, members]
  );
  const nonMemberProfiles = useMemo(
    () => (profiles ?? []).filter((p) => !(members ?? []).some((m) => m.user_id === p.id)),
    [profiles, members]
  );
  const progress = computeProgress(tasks ?? []);

  if (loading) return <LoadingState label="Cargando proyecto..." />;
  if (error) return <ErrorState description={error} onRetry={refetch} />;
  if (!project) return <NotFoundState label="Proyecto no encontrado" />;

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    await updateTaskStatus(taskId, status);
    refetchTasks();
  }

  async function handleUpdateProject(values: Parameters<typeof updateProject>[1]) {
    setSubmitting(true);
    await updateProject(project!.id, values);
    setSubmitting(false);
    setEditOpen(false);
    refetch();
  }

  async function handleDeleteProject() {
    setSubmitting(true);
    await deleteProject(project!.id);
    setSubmitting(false);
    navigate('/app/projects');
  }

  async function handleCreateTask(values: Parameters<typeof createTask>[0]) {
    setSubmitting(true);
    const { data } = await createTask(values);
    setSubmitting(false);
    if (data && profile) {
      await logActivity(profile.id, project!.id, `Creo la tarea "${data.title}"`);
    }
    setTaskModalOpen(false);
    refetchTasks();
  }

  async function handleAddMember() {
    if (!addMemberId) return;
    await addProjectMember(project!.id, addMemberId);
    setAddMemberId('');
    refetchMembers();
  }

  async function handleRemoveMember(userId: string) {
    await removeProjectMember(project!.id, userId);
    refetchMembers();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1>{project.name}</h1>
            <Badge color={projectStatusColor(project.status)}>{projectStatusLabel(project.status)}</Badge>
          </div>
          <p className="text-secondary">{clientName ?? 'Sin cliente asignado'}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>
              Editar
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirmDeleteOpen(true)}>
              Eliminar
            </Button>
          </div>
        )}
      </div>

      <div className="two-col mb-6">
        <div className="card card-padded">
          <h3 className="mb-2">Descripcion</h3>
          <p className="text-secondary text-body">{project.description || 'Sin descripcion.'}</p>
          <div className="two-col mt-4">
            <div>
              <div className="text-small text-muted">Fecha de inicio</div>
              <div>{project.start_date ?? '—'}</div>
            </div>
            <div>
              <div className="text-small text-muted">Fecha limite</div>
              <div>{project.due_date ?? '—'}</div>
            </div>
          </div>
        </div>
        <div className="card card-padded">
          <h3 className="mb-2">Progreso</h3>
          <ProjectProgress percent={progress} />
          <div className="text-small text-muted mt-2">
            {(tasks ?? []).filter((t) => t.status === 'DONE').length} de {(tasks ?? []).length} tareas completadas
          </div>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
          Tareas
        </div>
        <div className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>
          Equipo
        </div>
        <div className={`tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>
          Actividad
        </div>
      </div>

      {tab === 'tasks' && (
        <div className="card">
          <div className="flex justify-between items-center" style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 15 }}>Tareas del proyecto</h3>
            {isAdmin && (
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setTaskModalOpen(true)}>
                Nueva tarea
              </Button>
            )}
          </div>
          {(tasks ?? []).length === 0 ? (
            <EmptyState title="Sin tareas" description="Este proyecto todavia no tiene tareas registradas." />
          ) : (
            (tasks ?? []).map((t) => {
              const assignee = profiles?.find((p) => p.id === t.assigned_to);
              const canEditStatus = isAdmin || t.assigned_to === profile?.id;
              return (
                <TaskItem
                  key={t.id}
                  task={t}
                  assigneeName={assignee?.name}
                  onStatusChange={canEditStatus ? (status) => handleStatusChange(t.id, status) : undefined}
                />
              );
            })
          )}
        </div>
      )}

      {tab === 'team' && (
        <div className="card card-padded">
          {isAdmin && (
            <div className="flex gap-2 mb-4">
              <Select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} style={{ flex: 1 }}>
                <option value="">Selecciona un integrante para agregar</option>
                {nonMemberProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </Select>
              <Button variant="secondary" icon={<UserPlus size={15} />} onClick={handleAddMember} disabled={!addMemberId}>
                Agregar
              </Button>
            </div>
          )}
          {memberProfiles.length === 0 ? (
            <EmptyState title="Sin integrantes" description="Este proyecto todavia no tiene integrantes asignados." />
          ) : (
            <div className="flex flex-col gap-2">
              {memberProfiles.map((m) => (
                <div key={m.id} className="flex justify-between items-center" style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="avatar">{m.name.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div className="text-small text-muted">{m.role}</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.id)}>
                      Quitar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card">
          {(activity ?? []).length === 0 ? (
            <EmptyState title="Sin actividad reciente" />
          ) : (
            (activity ?? []).map((a) => {
              const user = profiles?.find((p) => p.id === a.user_id);
              return (
                <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                  <div className="text-body">{a.action}</div>
                  <div className="text-small text-muted mt-1">
                    {user?.name ?? 'Usuario'} · {new Date(a.created_at).toLocaleString('es-MX')}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <ProjectFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdateProject}
        clients={clients ?? []}
        initialProject={project}
        submitting={submitting}
      />
      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSubmit={handleCreateTask}
        projects={[project]}
        profiles={profiles ?? []}
        lockedProjectId={project.id}
        submitting={submitting}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar proyecto"
        message={`Se eliminara "${project.name}" y todas sus tareas asociadas. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        loading={submitting}
        onConfirm={handleDeleteProject}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
