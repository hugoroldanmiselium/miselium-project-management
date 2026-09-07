import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../Button';
import { Table, type Column } from '../Table';
import { EmptyState } from '../States';
import { ConfirmDialog } from '../ConfirmDialog';
import { ExpenseFormModal, type ExpenseFormValues } from '../forms/ExpenseFormModal';
import { createExpense, createFinanceCategory, deleteExpense, updateExpense } from '../../lib/queries';
import { formatMXN } from '../../lib/financeUtils';
import type { Expense, ExpenseStatus, FinanceCategory } from '../../types/database';

interface Props {
  expenses: Expense[];
  categories: FinanceCategory[];
  organizationId: string;
  userId: string;
  onRefetch: () => void;
  onCategoriesChanged: () => void;
}

export function ExpensesPanel({ expenses, categories, organizationId, userId, onRefetch, onCategoriesChanged }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExpenseStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && e.category_id !== categoryFilter) return false;
      return true;
    });
  }, [expenses, statusFilter, categoryFilter]);

  async function handleCreateCategory(name: string): Promise<FinanceCategory | null> {
    const { data } = await createFinanceCategory({ organization_id: organizationId, type: 'EXPENSE', name });
    onCategoriesChanged();
    return data;
  }

  async function handleSubmit(values: ExpenseFormValues) {
    setSubmitting(true);
    if (editing) {
      await updateExpense(editing.id, { ...values, updated_by: userId });
    } else {
      await createExpense({ ...values, organization_id: organizationId, created_by: userId });
    }
    setSubmitting(false);
    setModalOpen(false);
    setEditing(null);
    onRefetch();
  }

  async function handleStatusChange(expense: Expense, status: ExpenseStatus) {
    await updateExpense(expense.id, {
      status,
      paid_date: status === 'PAGADO' ? expense.paid_date ?? new Date().toISOString().slice(0, 10) : null,
      updated_by: userId,
    });
    onRefetch();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteExpense(deleteTarget.id);
    setDeleteTarget(null);
    onRefetch();
  }

  const columns: Column<Expense>[] = [
    { header: 'Fecha', key: 'date', render: (e) => e.date },
    { header: 'Concepto', key: 'concept', render: (e) => <span style={{ fontWeight: 500 }}>{e.concept}</span> },
    { header: 'Proveedor', key: 'vendor', render: (e) => e.vendor ?? '—' },
    { header: 'Categoria', key: 'category', render: (e) => (e.category_id ? categoryMap.get(e.category_id) ?? '—' : '—') },
    { header: 'Total', key: 'total', render: (e) => formatMXN(Number(e.total)) },
    {
      header: 'Estado',
      key: 'status',
      render: (e) => (
        <select
          className="select-inline"
          value={e.status}
          onChange={(ev) => handleStatusChange(e, ev.target.value as ExpenseStatus)}
          onClick={(ev) => ev.stopPropagation()}
        >
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
        </select>
      ),
    },
    {
      header: '',
      key: 'actions',
      render: (e) => (
        <div className="flex items-center gap-2" onClick={(ev) => ev.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(e);
              setModalOpen(true);
            }}
          >
            Editar
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(e)}>
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
          {(['ALL', 'PENDIENTE', 'PAGADO'] as const).map((s) => (
            <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'ALL' ? 'Todos' : s === 'PENDIENTE' ? 'Pendiente' : 'Pagado'}
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
          Nuevo egreso
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Sin egresos" description="No hay egresos que coincidan con este filtro." />
      ) : (
        <Table columns={columns} rows={filtered} rowKey={(e) => e.id} />
      )}

      <ExpenseFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        onCreateCategory={handleCreateCategory}
        categories={categories}
        initialExpense={editing}
        submitting={submitting}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar egreso"
        message={`Esto eliminara permanentemente "${deleteTarget?.concept}".`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
