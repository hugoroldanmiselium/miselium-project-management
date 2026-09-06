import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { Table, type Column } from '../components/Table';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Badge, projectStatusColor, projectStatusLabel } from '../components/Badge';
import { ProjectProgress, computeProgress } from '../components/ProjectProgress';
import { ProjectFormModal } from '../components/forms/ProjectFormModal';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { createProject, fetchClients, fetchProjects, fetchTasks, logActivity } from '../lib/queries';
import type { Project } from '../types/database';

export function Projects() {
  const { isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: projects, loading, error, refetch } = useSupabaseQuery(() => fetchProjects());
  const { data: clients } = useSupabaseQuery(() => fetchClients());
  const { data: tasks } = useSupabaseQuery(() => fetchTasks());

  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients]);
  const tasksByProject = useMemo(() => {
    const map = new Map<string, { status: string }[]>();
    (tasks ?? []).forEach((t) => {
      const arr = map.get(t.project_id) ?? [];
      arr.push({ status: t.status });
      map.set(t.project_id, arr);
    });
    return map;
  }, [tasks]);

  async function handleCreate(values: Parameters<typeof createProject>[0]) {
    setSubmitting(true);
    const { data, error: createError } = await createProject(values);
    setSubmitting(false);
    if (!createError) {
      if (profile && data) {
        await logActivity(profile.id, data.id, `Creo el proyecto "${data.name}"`);
      }
      setModalOpen(false);
      refetch();
    }
  }

  const columns: Column<Project>[] = [
    { header: 'Proyecto', key: 'name', render: (p) => <span style={{ fontWeight: 500 }}>{p.name}</span> },
    { header: 'Cliente', key: 'client', render: (p) => clientMap.get(p.client_id ?? '') ?? '—' },
    {
      header: 'Progreso',
      key: 'progress',
      render: (p) => <ProjectProgress percent={computeProgress(tasksByProject.get(p.id) ?? [])} />,
      width: '160px',
    },
    {
      header: 'Estado',
      key: 'status',
      render: (p) => <Badge color={projectStatusColor(p.status)}>{projectStatusLabel(p.status)}</Badge>,
    },
    { header: 'Fecha limite', key: 'due', render: (p) => p.due_date ?? '—' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Proyectos</h1>
          <p className="text-secondary mt-1">Todos los proyectos activos y su progreso.</p>
        </div>
        {isAdmin && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Nuevo proyecto
          </Button>
        )}
      </div>

      {loading && <LoadingState label="Cargando proyectos..." />}
      {!loading && error && <ErrorState description={error} onRetry={refetch} />}
      {!loading && !error && projects && projects.length === 0 && (
        <EmptyState
          title="Aun no hay proyectos"
          description={isAdmin ? 'Crea el primer proyecto para empezar.' : 'No estas asignado a ningun proyecto todavia.'}
        />
      )}
      {!loading && !error && projects && projects.length > 0 && (
        <Table columns={columns} rows={projects} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/app/projects/${p.id}`)} />
      )}

      <ProjectFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        clients={clients ?? []}
        submitting={submitting}
      />
    </div>
  );
}
