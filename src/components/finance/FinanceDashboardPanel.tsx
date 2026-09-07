import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt, Landmark, PiggyBank } from 'lucide-react';
import { StatCard } from '../StatCard';
import { EmptyState } from '../States';
import { HorizontalBarChart } from '../Chart';
import { todayDateStr } from '../../lib/recurringDates';
import {
  FINANCE_PERIOD_LABELS,
  formatMXN,
  inRange,
  rangeForPeriod,
  type FinancePeriodKey,
} from '../../lib/financeUtils';
import type { Expense, Income, TaxProvision } from '../../types/database';

interface Props {
  incomes: Income[];
  expenses: Expense[];
  taxProvisions: TaxProvision[];
}

export function FinanceDashboardPanel({ incomes, expenses, taxProvisions }: Props) {
  const [period, setPeriod] = useState<FinancePeriodKey>('month');
  const [customStart, setCustomStart] = useState(todayDateStr());
  const [customEnd, setCustomEnd] = useState(todayDateStr());

  const range = useMemo(
    () => rangeForPeriod(period, { start: customStart, end: customEnd }),
    [period, customStart, customEnd]
  );

  const incomesInRange = useMemo(() => incomes.filter((i) => inRange(i.date, range)), [incomes, range]);
  const expensesInRange = useMemo(() => expenses.filter((e) => inRange(e.date, range)), [expenses, range]);
  const taxesInRange = useMemo(() => taxProvisions.filter((t) => inRange(t.date, range)), [taxProvisions, range]);

  const totalIncome = incomesInRange.reduce((sum, i) => sum + Number(i.total), 0);
  const totalExpense = expensesInRange.reduce((sum, e) => sum + Number(e.total), 0);
  const totalTaxes = taxesInRange.reduce((sum, t) => sum + Number(t.total_provisioned), 0);
  const netProfit = totalIncome - totalExpense - totalTaxes;

  // Flujo de efectivo: dinero efectivamente movido (cobrado - pagado), vs.
  // resultado gerencial (totalIncome - totalExpense above, accrual-style -
  // counts everything regardless of collected/paid status).
  const cashIn = incomesInRange.filter((i) => i.status === 'COBRADO').reduce((sum, i) => sum + Number(i.total), 0);
  const cashOut = expensesInRange.filter((e) => e.status === 'PAGADO').reduce((sum, e) => sum + Number(e.total), 0);
  const cashFlow = cashIn - cashOut;

  const chartData = [
    { label: 'Ingresos', value: totalIncome },
    { label: 'Egresos', value: totalExpense },
    { label: 'Impuestos', value: totalTaxes },
  ];
  const maxVal = Math.max(totalIncome, totalExpense, totalTaxes, 1);

  return (
    <div>
      <div className="filter-bar mb-4">
        {(Object.keys(FINANCE_PERIOD_LABELS) as FinancePeriodKey[]).map((p) => (
          <button key={p} className={`filter-chip ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
            {FINANCE_PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="two-col mb-4" style={{ maxWidth: 420 }}>
          <div className="field">
            <label className="field-label">Desde</label>
            <input className="input" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Hasta</label>
            <input className="input" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="stat-grid mb-6">
        <StatCard label="Ingresos" value={formatMXN(totalIncome)} icon={<TrendingUp size={14} />} delta={`${incomesInRange.length} movimientos`} accent="green" />
        <StatCard label="Egresos" value={formatMXN(totalExpense)} icon={<TrendingDown size={14} />} delta={`${expensesInRange.length} movimientos`} accent="red" />
        <StatCard label="Gastos" value={formatMXN(totalExpense)} icon={<Receipt size={14} />} delta="ver desglose en Analisis" />
        <StatCard label="Impuestos" value={formatMXN(totalTaxes)} icon={<Landmark size={14} />} delta="provisiones del periodo" accent="amber" />
        <StatCard
          label="Utilidad neta"
          value={formatMXN(netProfit)}
          icon={<PiggyBank size={14} />}
          delta="Ingresos - Egresos - Impuestos"
          accent={netProfit >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Flujo de efectivo"
          value={formatMXN(cashFlow)}
          icon={<Wallet size={14} />}
          delta={`Cobrado ${formatMXN(cashIn)} - Pagado ${formatMXN(cashOut)}`}
          accent={cashFlow >= 0 ? 'blue' : 'amber'}
        />
      </div>

      <div className="card card-padded">
        <h3 className="mb-4">Comparativo del periodo</h3>
        {totalIncome === 0 && totalExpense === 0 && totalTaxes === 0 ? (
          <EmptyState title="Sin movimientos en este periodo" />
        ) : (
          <HorizontalBarChart
            data={chartData.map((d) => ({ label: d.label, value: Math.round((d.value / maxVal) * 100) }))}
            max={100}
          />
        )}
      </div>
    </div>
  );
}
