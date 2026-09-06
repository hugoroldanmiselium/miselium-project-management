import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { deleteClient, fetchClient, fetchProjects, updateClient } from '../lib/queries';
import { LoadingState, ErrorState, NotFoundState, EmptyState } from '../components/States';
import { Badge, projectStatusColor, projectStatusLabel } from '../components/Badge';
import { Button } from '../components/Button';
import { ClientFormModal } from '../components/forms/ClientFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: client, loading, error, refetch } = useSupabaseQuery(() => fetchClient(id!), [id]);
  const { data: projects } = useSupabaseQuery(() => fetchProjects());

  const relatedProjects = useMemo(() => (projects ?? []).filter((p) => p.client_id === id), [projects, id]);

  if (loading) return <LoadingState label="Cargando cliente..." />;
  if (error) return <ErrorState description={error} onRetry={refetch} />;
  if (!client) return <NotFoundState label="Cliente no encontrado" />;

  async function handleUpdate(values: Parameters<typeof updateClient>[1]) {
    setSubmitting(true);
    await updateClient(client!.id, values);
    setSubmitting(false);
    setEditOpen(false);
    refetch();
  }

  async function handleDelete() {
    setSubmitting(true);
    await deleteClient(client!.id);
    setSubmitting(false);
    navigate('/app/clients');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{client.name}</h1>
          <p className="text-secondary mt-1">{client.contact_name ?? 'Sin contacto asignado'}</p>
        </div>
        {canManage && (
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
          <h3 className="mb-2">Informacion de contacto</h3>
          <div className="flex flex-col gap-2 text-body">
            <div>
              <span className="text-muted">Correo: </span>
              {client.email ?? '—'}
            </div>
            <div>
              <span className="text-muted">Telefono: </span>
              {client.phone ?? '—'}
            </div>
          </div>
        </div>
        <div className="card card-padded">
          <h3 className="mb-2">Notas</h3>
          <p className="text-secondary text-body">{client.notes || 'Sin notas.'}</p>
        </div>
      </div>

      <h3 className="mb-4">Proyectos relacionados</h3>
      {relatedProjects.length === 0 ? (
        <EmptyState title="Sin proyectos" description="Este cliente no tiene proyectos registrados." />
      ) : (
        <div className="card">
          {relatedProjects.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center table-row-clickable"
              style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}
              onClick={() => navigate(`/app/projects/${p.id}`)}
            >
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              <Badge color={projectStatusColor(p.status)}>{projectStatusLabel(p.status)}</Badge>
            </div>
          ))}
        </div>
      )}

      <ClientFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        initialClient={client}
        submitting={submitting}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Eliminar cliente"
        message={`Se eliminara "${client.name}". Los proyectos asociados quedaran sin cliente.`}
        confirmLabel="Eliminar"
        danger
        loading={submitting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
