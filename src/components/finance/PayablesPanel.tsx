import { useMemo } from 'react';
import { Table, type Column } from '../Table';
import { EmptyState } from '../States';
import { Badge } from '../Badge';
import { StatCard } from '../StatCard';
import { updateExpense } from '../../lib/queries';
import { daysPending, formatMXN, isOverdueDate } from '../../lib/financeUtils';
import type { Expense, ExpenseStatus } from '../../types/database';

interface Props {
  expenses: Expense[];
  userId: string;
  onRefetch: () => void;
}

export function PayablesPanel({ expenses, userId, onRefetch }: Props) {
  const pending = useMemo(() => expenses.filter((e) => e.status === 'PENDIENTE'), [expenses]);

  const totalPending = pending.reduce((sum, e) => sum + Number(e.total), 0);
  const overdue = pending.filter((e) => isOverdueDate(e.due_date));
  const totalOverdue = overdue.reduce((sum, e) => sum + Number(e.total), 0);
  const upcoming = pending.filter((e) => !isOverdueDate(e.due_date));
  const totalUpcoming = upcoming.reduce((sum, e) => sum + Number(e.total), 0);

  async function markPaid(expense: Expense, status: ExpenseStatus) {
    await updateExpense(expense.id, {
      status,
      paid_date: status === 'PAGADO' ? new Date().toISOString().slice(0, 10) : null,
      updated_by: userId,
    });
    onRefetch();
  }

  const columns: Column<Expense>[] = [
    { header: 'Proveedor', key: 'vendor', render: (e) => e.vendor ?? '—' },
    { header: 'Concepto', key: 'concept', render: (e) => e.concept },
    { header: 'Fecha', key: 'date', render: (e) => e.date },
    { header: 'Vencimiento', key: 'due', render: (e) => e.due_date ?? '—' },
    { header: 'Monto', key: 'amount', render: (e) => formatMXN(Number(e.total)) },
    {
      header: 'Dias pendientes',
      key: 'days',
      render: (e) => {
        const d = daysPending(e.due_date);
        if (d === null) return '—';
        return d > 0 ? <Badge color="red">{d}d vencido</Badge> : <Badge color="blue">{-d}d por vencer</Badge>;
      },
    },
    {
      header: 'Estado',
      key: 'status',
      render: (e) => (
        <select
          className="select-inline"
          value={e.status}
          onChange={(ev) => markPaid(e, ev.target.value as ExpenseStatus)}
          onClick={(ev) => ev.stopPropagation()}
        >
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
        </select>
      ),
    },
  ];

  return (
    <div>
      <div className="stat-grid mb-6">
        <StatCard label="Total por pagar" value={formatMXN(totalPending)} delta={`${pending.length} pendientes`} />
        <StatCard label="Vencido" value={formatMXN(totalOverdue)} delta={`${overdue.length} vencidos`} />
        <StatCard label="Por vencer" value={formatMXN(totalUpcoming)} delta={`${upcoming.length} por vencer`} />
      </div>
      {pending.length === 0 ? (
        <EmptyState title="Sin cuentas por pagar" description="No hay egresos pendientes de pago." />
      ) : (
        <Table columns={columns} rows={pending} rowKey={(e) => e.id} />
      )}
    </div>
  );
}
