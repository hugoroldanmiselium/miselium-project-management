import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import {
  fetchClients,
  fetchExpenses,
  fetchFinanceCategories,
  fetchIncomes,
  fetchProfiles,
  fetchTaxProvisions,
} from '../lib/queries';
import { LoadingState, ErrorState, UnauthorizedState } from '../components/States';
import { FinanceDashboardPanel } from '../components/finance/FinanceDashboardPanel';
import { IncomesPanel } from '../components/finance/IncomesPanel';
import { ExpensesPanel } from '../components/finance/ExpensesPanel';
import { TaxesPanel } from '../components/finance/TaxesPanel';
import { ReceivablesPanel } from '../components/finance/ReceivablesPanel';
import { PayablesPanel } from '../components/finance/PayablesPanel';
import { AnalysisPanel } from '../components/finance/AnalysisPanel';

type FinanceTab = 'dashboard' | 'incomes' | 'expenses' | 'taxes' | 'receivables' | 'payables' | 'analysis';

const TABS: { key: FinanceTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'incomes', label: 'Ingresos' },
  { key: 'expenses', label: 'Egresos' },
  { key: 'taxes', label: 'Impuestos' },
  { key: 'receivables', label: 'Cuentas por cobrar' },
  { key: 'payables', label: 'Cuentas por pagar' },
  { key: 'analysis', label: 'Analisis' },
];

export function Finance() {
  const { hasFinanceAccess, profile } = useAuth();
  const [tab, setTab] = useState<FinanceTab>('dashboard');

  const { data: incomes, loading: loadingIncomes, error: errorIncomes, refetch: refetchIncomes } = useSupabaseQuery(() => fetchIncomes());
  const { data: expenses, loading: loadingExpenses, error: errorExpenses, refetch: refetchExpenses } = useSupabaseQuery(() =>
    fetchExpenses()
  );
  const { data: taxProvisions, loading: loadingTaxes, error: errorTaxes, refetch: refetchTaxes } = useSupabaseQuery(() =>
    fetchTaxProvisions()
  );
  const { data: categories, refetch: refetchCategories } = useSupabaseQuery(() => fetchFinanceCategories());
  const { data: clients } = useSupabaseQuery(() => fetchClients());
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());

  if (!hasFinanceAccess) {
    return <UnauthorizedState />;
  }

  const loading = loadingIncomes || loadingExpenses || loadingTaxes;
  const error = errorIncomes || errorExpenses || errorTaxes;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Finanzas</h1>
          <p className="text-secondary mt-1">Ingresos, egresos, impuestos y analisis financiero de tu empresa.</p>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {loading && <LoadingState label="Cargando finanzas..." />}
      {!loading && error && <ErrorState description={error} />}

      {!loading && !error && (
        <>
          {tab === 'dashboard' && (
            <FinanceDashboardPanel incomes={incomes ?? []} expenses={expenses ?? []} taxProvisions={taxProvisions ?? []} />
          )}
          {tab === 'incomes' && (
            <IncomesPanel
              incomes={incomes ?? []}
              clients={clients ?? []}
              categories={(categories ?? []).filter((c) => c.type === 'INCOME')}
              organizationId={profile?.organization_id ?? ''}
              userId={profile?.id ?? ''}
              onRefetch={refetchIncomes}
              onCategoriesChanged={refetchCategories}
            />
          )}
          {tab === 'expenses' && (
            <ExpensesPanel
              expenses={expenses ?? []}
              categories={(categories ?? []).filter((c) => c.type === 'EXPENSE')}
              organizationId={profile?.organization_id ?? ''}
              userId={profile?.id ?? ''}
              onRefetch={refetchExpenses}
              onCategoriesChanged={refetchCategories}
            />
          )}
          {tab === 'taxes' && (
            <TaxesPanel
              taxProvisions={taxProvisions ?? []}
              organizationId={profile?.organization_id ?? ''}
              userId={profile?.id ?? ''}
              onRefetch={refetchTaxes}
            />
          )}
          {tab === 'receivables' && (
            <ReceivablesPanel incomes={incomes ?? []} clients={clients ?? []} onRefetch={refetchIncomes} userId={profile?.id ?? ''} />
          )}
          {tab === 'payables' && <PayablesPanel expenses={expenses ?? []} onRefetch={refetchExpenses} userId={profile?.id ?? ''} />}
          {tab === 'analysis' && (
            <AnalysisPanel incomes={incomes ?? []} expenses={expenses ?? []} categories={categories ?? []} profiles={profiles ?? []} />
          )}
        </>
      )}
    </div>
  );
}
