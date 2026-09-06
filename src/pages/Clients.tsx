import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { Table, type Column } from '../components/Table';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { ClientFormModal } from '../components/forms/ClientFormModal';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { createClient, fetchClients, fetchProjects } from '../lib/queries';
import type { Client } from '../types/database';

export function Clients() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: clients, loading, error, refetch } = useSupabaseQuery(() => fetchClients());
  const { data: projects } = useSupabaseQuery(() => fetchProjects());

  const projectCountByClient = useMemo(() => {
    const map = new Map<string, number>();
    (projects ?? []).forEach((p) => {
      if (!p.client_id) return;
      map.set(p.client_id, (map.get(p.client_id) ?? 0) + 1);
    });
    return map;
  }, [projects]);

  const activeStatusByClient = useMemo(() => {
    const map = new Map<string, boolean>();
    (projects ?? []).forEach((p) => {
      if (!p.client_id) return;
      if (p.status === 'ACTIVE') map.set(p.client_id, true);
    });
    return map;
  }, [projects]);

  async function handleCreate(values: Parameters<typeof createClient>[0]) {
    setSubmitting(true);
    await createClient(values);
    setSubmitting(false);
    setModalOpen(false);
    refetch();
  }

  const columns: Column<Client>[] = [
    { header: 'Cliente', key: 'name', render: (c) => <span style={{ fontWeight: 500 }}>{c.name}</span> },
    { header: 'Contacto', key: 'contact', render: (c) => c.contact_name ?? '—' },
    { header: 'Proyectos', key: 'projects', render: (c) => projectCountByClient.get(c.id) ?? 0 },
    {
      header: 'Estado',
      key: 'status',
      render: (c) => (activeStatusByClient.get(c.id) ? 'Con proyectos activos' : 'Sin proyectos activos'),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p className="text-secondary mt-1">Directorio de clientes de Miselium.</p>
        </div>
        {isAdmin && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Nuevo cliente
          </Button>
        )}
      </div>

      {loading && <LoadingState label="Cargando clientes..." />}
      {!loading && error && <ErrorState description={error} onRetry={refetch} />}
      {!loading && !error && clients && clients.length === 0 && (
        <EmptyState title="Sin clientes" description="Todavia no hay clientes registrados." />
      )}
      {!loading && !error && clients && clients.length > 0 && (
        <Table columns={columns} rows={clients} rowKey={(c) => c.id} onRowClick={(c) => navigate(`/app/clients/${c.id}`)} />
      )}

      <ClientFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} submitting={submitting} />
    </div>
  );
}
