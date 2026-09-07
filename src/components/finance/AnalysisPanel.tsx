import { useMemo } from 'react';
import { StatCard } from '../StatCard';
import { EmptyState } from '../States';
import { DonutChart, HorizontalBarChart } from '../Chart';
import { todayDateStr } from '../../lib/recurringDates';
import {
  formatMXN,
  groupExpensesByCategory,
  monthLabel,
  monthlyTotals,
  projectMonthClose,
  rangeForPeriod,
} from '../../lib/financeUtils';
import type { Expense, FinanceCategory, Income, Profile } from '../../types/database';

interface Props {
  incomes: Income[];
  expenses: Expense[];
  categories: FinanceCategory[];
  profiles: Profile[];
}

const DONUT_COLORS = [
  'var(--color-blue)',
  'var(--color-green)',
  'var(--color-yellow)',
  'var(--color-red)',
  'var(--color-purple)',
  'var(--color-gray-400)',
];

export function AnalysisPanel({ incomes, expenses, categories }: Props) {
  const today = todayDateStr();
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const incomeByMonth = useMemo(() => monthlyTotals(incomes, 6, today), [incomes, today]);
  const expenseByMonth = useMemo(() => monthlyTotals(expenses, 6, today), [expenses, today]);
  const profitByMonth = useMemo(
    () => incomeByMonth.map((m, i) => ({ month: m.month, total: m.total - expenseByMonth[i].total })),
    [incomeByMonth, expenseByMonth]
  );

  const expenseCategoryBreakdown = useMemo(
    () => groupExpensesByCategory(expenses, categoryNameById),
    [expenses, categoryNameById]
  );

  const monthRange = useMemo(() => rangeForPeriod('month', undefined, today), [today]);
  const thisMonthIncome = incomes.filter((i) => i.date >= monthRange.start && i.date <= monthRange.end).reduce((s, i) => s + Number(i.total), 0);
  const thisMonthExpense = expenses.filter((e) => e.date >= monthRange.start && e.date <= monthRange.end).reduce((s, e) => s + Number(e.total), 0);
  const netMargin = thisMonthIncome > 0 ? ((thisMonthIncome - thisMonthExpense) / thisMonthIncome) * 100 : 0;

  const projection = useMemo(() => projectMonthClose(incomes, expenses, monthRange), [incomes, expenses, monthRange]);

  const maxMonthly = Math.max(...incomeByMonth.map((m) => m.total), ...expenseByMonth.map((m) => m.total), 1);

  const hasData = incomes.length > 0 || expenses.length > 0;

  if (!hasData) {
    return <EmptyState title="Sin datos suficientes" description="Registra ingresos y egresos para ver el analisis." />;
  }

  return (
    <div>
      <div className="stat-grid mb-6">
        <StatCard label="Margen neto (este mes)" value={`${netMargin.toFixed(1)}%`} delta="Utilidad / Ingresos x 100" />
        <StatCard label="Burn rate" value={formatMXN(projection.burnRate)} delta="promedio egresos, ult. 3 meses" />
        <StatCard
          label="Proyeccion de cierre de mes"
          value={formatMXN(projection.projectedProfit)}
          delta={`Ingresos ${formatMXN(projection.projectedIncome)} - Egresos ${formatMXN(projection.projectedExpense)}`}
        />
      </div>

      <div className="two-col mb-6">
        <div className="card card-padded">
          <h3 className="mb-4">Ingresos vs egresos (6 meses)</h3>
          <HorizontalBarChart
            data={incomeByMonth.map((m) => ({
              label: `${monthLabel(m.month)} · Ingresos`,
              value: Math.round((m.total / maxMonthly) * 100),
            }))}
            max={100}
          />
          <div style={{ height: 12 }} />
          <HorizontalBarChart
            data={expenseByMonth.map((m) => ({
              label: `${monthLabel(m.month)} · Egresos`,
              value: Math.round((m.total / maxMonthly) * 100),
            }))}
            max={100}
          />
        </div>
        <div className="card card-padded">
          <h3 className="mb-4">Gastos por categoria</h3>
          {expenseCategoryBreakdown.length === 0 ? (
            <EmptyState title="Sin egresos" />
          ) : (
            <DonutChart
              data={expenseCategoryBreakdown.slice(0, 6).map((c, i) => ({
                label: c.name,
                value: Math.round(c.total),
                color: DONUT_COLORS[i % DONUT_COLORS.length],
              }))}
            />
          )}
        </div>
      </div>

      <div className="card card-padded">
        <h3 className="mb-4">Utilidad mensual (6 meses)</h3>
        <HorizontalBarChart
          data={profitByMonth.map((m) => ({
            label: monthLabel(m.month),
            value: Math.round((Math.max(m.total, 0) / Math.max(maxMonthly, 1)) * 100),
          }))}
          max={100}
        />
        <p className="text-small text-muted mt-2">
          Las barras muestran magnitud relativa; un mes con utilidad negativa se muestra en 0.
        </p>
      </div>
    </div>
  );
}
