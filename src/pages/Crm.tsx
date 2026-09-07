import { useMemo, useState } from 'react';
import { Plus, Search, Users2, Wallet2, CalendarClock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { createContact, deleteContact, fetchContacts, fetchProfiles, updateContact } from '../lib/queries';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Badge, followupStatusColor } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { Table, type Column } from '../components/Table';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ContactFormModal, type ContactFormValues } from '../components/forms/ContactFormModal';
import { ContactDetailModal } from '../components/ContactDetailModal';
import {
  FOLLOWUP_STATUS_EMOJI,
  FOLLOWUP_STATUS_LABEL,
  countByStatus,
  followupStatus,
  formatFollowup,
  formatLastContact,
  matchesSearch,
  sumPotentialValue,
  type FollowupStatus,
} from '../lib/crmUtils';
import { formatMXN } from '../lib/financeUtils';
import type { Contact } from '../types/database';

type FilterKey = 'ALL' | FollowupStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'OVERDUE', label: 'Vencidos' },
  { key: 'TODAY', label: 'Hoy' },
  { key: 'UPCOMING', label: 'Proximos' },
  { key: 'NONE', label: 'Sin seguimiento' },
];

export function Crm() {
  const { canManage, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const { data: contacts, loading, error, refetch } = useSupabaseQuery(() => fetchContacts());
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());

  const kpis = useMemo(() => {
    const all = contacts ?? [];
    return {
      total: all.length,
      potentialValue: sumPotentialValue(all),
      today: countByStatus(all, 'TODAY'),
      overdue: countByStatus(all, 'OVERDUE'),
    };
  }, [contacts]);

  const filtered = useMemo(() => {
    const all = contacts ?? [];
    return all
      .filter((c) => matchesSearch(c, search))
      .filter((c) => filter === 'ALL' || followupStatus(c.next_followup_at) === filter);
  }, [contacts, search, filter]);

  async function handleCreate(values: ContactFormValues) {
    if (!profile) return;
    setSubmitting(true);
    if (editing) {
      await updateContact(editing.id, { ...values, updated_by: profile.id });
    } else {
      await createContact({ ...values, organization_id: profile.organization_id, created_by: profile.id });
    }
    setSubmitting(false);
    setModalOpen(false);
    setEditing(null);
    refetch();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    await deleteContact(deleteTarget.id);
    setSubmitting(false);
    setDeleteTarget(null);
    setActiveContact(null);
    refetch();
  }

  const columns: Column<Contact>[] = [
    { header: 'Nombre', key: 'name', render: (c) => <span style={{ fontWeight: 500 }}>{c.name}</span> },
    { header: 'Empresa / actividad', key: 'company', render: (c) => c.company ?? '—' },
    {
      header: 'Valor',
      key: 'value',
      render: (c) => (c.potential_value != null ? formatMXN(Number(c.potential_value)) : '—'),
    },
    { header: 'Ultimo contacto', key: 'last_contact', render: (c) => formatLastContact(c.last_contact_date) },
    { header: 'Proximo seguimiento', key: 'next_followup', render: (c) => formatFollowup(c.next_followup_at) },
    {
      header: 'Estado',
      key: 'status',
      render: (c) => {
        const status = followupStatus(c.next_followup_at);
        return (
          <Badge color={followupStatusColor(status)}>
            {FOLLOWUP_STATUS_EMOJI[status]} {FOLLOWUP_STATUS_LABEL[status]}
          </Badge>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>CRM</h1>
          <p className="text-secondary mt-1">Contactos y prospectos comerciales de tu organizacion.</p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Nuevo contacto
          </Button>
        )}
      </div>

      <div className="stat-grid mb-6">
        <StatCard label="Contactos" value={kpis.total} icon={<Users2 size={14} />} />
        <StatCard
          label="Valor comercial potencial"
          value={formatMXN(kpis.potentialValue)}
          icon={<Wallet2 size={14} />}
          delta="Estimado, no es un ingreso real"
        />
        <StatCard label="Seguimientos hoy" value={kpis.today} icon={<CalendarClock size={14} />} />
        <StatCard label="Vencidos" value={kpis.overdue} icon={<AlertTriangle size={14} />} />
      </div>

      <div className="page-header">
        <div className="input-with-icon" style={{ maxWidth: 320 }}>
          <Search size={16} />
          <input
            className="input"
            placeholder="Buscar por nombre, empresa, telefono o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-bar mb-4">
        {FILTERS.map((f) => (
          <button key={f.key} className={`filter-chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Cargando contactos..." />}
      {!loading && error && <ErrorState description={error} onRetry={refetch} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="Sin contactos" description="No hay contactos que coincidan con la busqueda o el filtro." />
      )}
      {!loading && !error && filtered.length > 0 && (
        <Table columns={columns} rows={filtered} rowKey={(c) => c.id} onRowClick={(c) => setActiveContact(c)} />
      )}

      <ContactFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleCreate}
        initialContact={editing}
        submitting={submitting}
      />

      <ContactDetailModal
        open={!!activeContact}
        onClose={() => setActiveContact(null)}
        contact={activeContact}
        profiles={profiles ?? []}
        onChanged={refetch}
        onEdit={
          canManage
            ? () => {
                setEditing(activeContact);
                setActiveContact(null);
                setModalOpen(true);
              }
            : undefined
        }
        onDelete={
          canManage
            ? () => {
                setDeleteTarget(activeContact);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar contacto"
        message={`Esto eliminara permanentemente "${deleteTarget?.name}" y su historial.`}
        confirmLabel="Eliminar"
        danger
        loading={submitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
