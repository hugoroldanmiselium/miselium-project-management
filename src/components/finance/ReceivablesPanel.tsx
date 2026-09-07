import { useMemo } from 'react';
import { Table, type Column } from '../Table';
import { EmptyState } from '../States';
import { Badge } from '../Badge';
import { StatCard } from '../StatCard';
import { updateIncome } from '../../lib/queries';
import { daysPending, formatMXN, isOverdueDate } from '../../lib/financeUtils';
import type { Client, Income, IncomeStatus } from '../../types/database';

interface Props {
  incomes: Income[];
  clients: Client[];
  userId: string;
  onRefetch: () => void;
}

export function ReceivablesPanel({ incomes, clients, userId, onRefetch }: Props) {
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const pending = useMemo(() => incomes.filter((i) => i.status === 'PENDIENTE'), [incomes]);

  const totalPending = pending.reduce((sum, i) => sum + Number(i.total), 0);
  const overdue = pending.filter((i) => isOverdueDate(i.due_date));
  const totalOverdue = overdue.reduce((sum, i) => sum + Number(i.total), 0);
  const upcoming = pending.filter((i) => !isOverdueDate(i.due_date));
  const totalUpcoming = upcoming.reduce((sum, i) => sum + Number(i.total), 0);

  async function markCollected(income: Income, status: IncomeStatus) {
    await updateIncome(income.id, {
      status,
      collected_date: status === 'COBRADO' ? new Date().toISOString().slice(0, 10) : null,
      updated_by: userId,
    });
    onRefetch();
  }

  const columns: Column<Income>[] = [
    { header: 'Cliente', key: 'client', render: (i) => (i.client_id ? clientMap.get(i.client_id) ?? '—' : '—') },
    { header: 'Concepto', key: 'concept', render: (i) => i.concept },
    { header: 'Fecha', key: 'date', render: (i) => i.date },
    { header: 'Vencimiento', key: 'due', render: (i) => i.due_date ?? '—' },
    { header: 'Monto', key: 'amount', render: (i) => formatMXN(Number(i.total)) },
    {
      header: 'Dias pendientes',
      key: 'days',
      render: (i) => {
        const d = daysPending(i.due_date);
        if (d === null) return '—';
        return d > 0 ? <Badge color="red">{d}d vencido</Badge> : <Badge color="blue">{-d}d por vencer</Badge>;
      },
    },
    {
      header: 'Estado',
      key: 'status',
      render: (i) => (
        <select
          className="select-inline"
          value={i.status}
          onChange={(e) => markCollected(i, e.target.value as IncomeStatus)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="PENDIENTE">Pendiente</option>
          <option value="COBRADO">Cobrado</option>
        </select>
      ),
    },
  ];

  return (
    <div>
      <div className="stat-grid mb-6">
        <StatCard label="Total por cobrar" value={formatMXN(totalPending)} delta={`${pending.length} pendientes`} />
        <StatCard label="Vencido" value={formatMXN(totalOverdue)} delta={`${overdue.length} vencidos`} />
        <StatCard label="Por vencer" value={formatMXN(totalUpcoming)} delta={`${upcoming.length} por vencer`} />
      </div>
      {pending.length === 0 ? (
        <EmptyState title="Sin cuentas por cobrar" description="No hay ingresos pendientes de cobro." />
      ) : (
        <Table columns={columns} rows={pending} rowKey={(i) => i.id} />
      )}
    </div>
  );
}
