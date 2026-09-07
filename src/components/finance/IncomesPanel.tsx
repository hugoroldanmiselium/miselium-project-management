import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../Button';
import { Table, type Column } from '../Table';
import { EmptyState } from '../States';
import { ConfirmDialog } from '../ConfirmDialog';
import { IncomeFormModal, type IncomeFormValues } from '../forms/IncomeFormModal';
import { createFinanceCategory, createIncome, deleteIncome, updateIncome } from '../../lib/queries';
import { formatMXN } from '../../lib/financeUtils';
import type { Client, FinanceCategory, Income, IncomeStatus } from '../../types/database';

interface Props {
  incomes: Income[];
  clients: Client[];
  categories: FinanceCategory[];
  organizationId: string;
  userId: string;
  onRefetch: () => void;
  onCategoriesChanged: () => void;
}

export function IncomesPanel({ incomes, clients, categories, organizationId, userId, onRefetch, onCategoriesChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncomeStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    return incomes.filter((i) => {
      if (statusFilter !== 'ALL' && i.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && i.category_id !== categoryFilter) return false;
      return true;
    });
  }, [incomes, statusFilter, categoryFilter]);

  async function handleCreateCategory(name: string): Promise<FinanceCategory | null> {
    const { data } = await createFinanceCategory({ organization_id: organizationId, type: 'INCOME', name });
    onCategoriesChanged();
    return data;
  }

  async function handleSubmit(values: IncomeFormValues) {
    setSubmitting(true);
    if (editing) {
      await updateIncome(editing.id, { ...values, updated_by: userId });
    } else {
      await createIncome({ ...values, organization_id: organizationId, created_by: userId });
    }
    setSubmitting(false);
    setModalOpen(false);
    setEditing(null);
    onRefetch();
  }

  async function handleStatusChange(income: Income, status: IncomeStatus) {
    await updateIncome(income.id, {
      status,
      collected_date: status === 'COBRADO' ? income.collected_date ?? new Date().toISOString().slice(0, 10) : null,
      updated_by: userId,
    });
    onRefetch();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteIncome(deleteTarget.id);
    setDeleteTarget(null);
    onRefetch();
  }

  const columns: Column<Income>[] = [
    { header: 'Fecha', key: 'date', render: (i) => i.date },
    { header: 'Concepto', key: 'concept', render: (i) => <span style={{ fontWeight: 500 }}>{i.concept}</span> },
    { header: 'Cliente', key: 'client', render: (i) => (i.client_id ? clientMap.get(i.client_id) ?? '—' : '—') },
    { header: 'Categoria', key: 'category', render: (i) => (i.category_id ? categoryMap.get(i.category_id) ?? '—' : '—') },
    { header: 'Total', key: 'total', render: (i) => formatMXN(Number(i.total)) },
    {
      header: 'Estado',
      key: 'status',
      render: (i) => (
        <select
          className="select-inline"
          value={i.status}
          onChange={(e) => handleStatusChange(i, e.target.value as IncomeStatus)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="PENDIENTE">Pendiente</option>
          <option value="COBRADO">Cobrado</option>
        </select>
      ),
    },
    {
      header: '',
      key: 'actions',
      render: (i) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(i);
              setModalOpen(true);
            }}
          >
            Editar
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(i)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filter-bar">
          {(['ALL', 'PENDIENTE', 'COBRADO'] as const).map((s) => (
            <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'ALL' ? 'Todos' : s === 'PENDIENTE' ? 'Pendiente' : 'Cobrado'}
            </button>
          ))}
          <select className="select-inline" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="ALL">Todas las categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          Nuevo ingreso
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Sin ingresos" description="No hay ingresos que coincidan con este filtro." />
      ) : (
        <Table columns={columns} rows={filtered} rowKey={(i) => i.id} />
      )}

      <IncomeFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        onCreateCategory={handleCreateCategory}
        clients={clients}
        categories={categories}
        initialIncome={editing}
        submitting={submitting}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar ingreso"
        message={`Esto eliminara permanentemente "${deleteTarget?.concept}".`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
