import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../Button';
import { Table, type Column } from '../Table';
import { EmptyState } from '../States';
import { ConfirmDialog } from '../ConfirmDialog';
import { TaxProvisionFormModal, type TaxProvisionFormValues } from '../forms/TaxProvisionFormModal';
import { createTaxProvision, deleteTaxProvision, updateTaxProvision } from '../../lib/queries';
import { formatMXN } from '../../lib/financeUtils';
import type { TaxProvision, TaxProvisionStatus } from '../../types/database';

interface Props {
  taxProvisions: TaxProvision[];
  organizationId: string;
  userId: string;
  onRefetch: () => void;
}

export function TaxesPanel({ taxProvisions, organizationId, userId, onRefetch }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaxProvision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaxProvision | null>(null);

  async function handleSubmit(values: TaxProvisionFormValues) {
    setSubmitting(true);
    if (editing) {
      await updateTaxProvision(editing.id, { ...values, updated_by: userId });
    } else {
      await createTaxProvision({ ...values, organization_id: organizationId, created_by: userId });
    }
    setSubmitting(false);
    setModalOpen(false);
    setEditing(null);
    onRefetch();
  }

  async function handleStatusChange(tp: TaxProvision, status: TaxProvisionStatus) {
    await updateTaxProvision(tp.id, { status, updated_by: userId });
    onRefetch();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteTaxProvision(deleteTarget.id);
    setDeleteTarget(null);
    onRefetch();
  }

  const columns: Column<TaxProvision>[] = [
    { header: 'Fecha', key: 'date', render: (t) => t.date },
    { header: 'Tipo', key: 'type', render: (t) => <span style={{ fontWeight: 500 }}>{t.tax_type}</span> },
    { header: 'Periodo', key: 'period', render: (t) => t.period },
    { header: 'Total provisionado', key: 'provisioned', render: (t) => formatMXN(Number(t.total_provisioned)) },
    { header: 'Total pagado', key: 'paid', render: (t) => formatMXN(Number(t.total_paid ?? 0)) },
    {
      header: 'Estado',
      key: 'status',
      render: (t) => (
        <select
          className="select-inline"
          value={t.status}
          onChange={(e) => handleStatusChange(t, e.target.value as TaxProvisionStatus)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
        </select>
      ),
    },
    {
      header: '',
      key: 'actions',
      render: (t) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(t);
              setModalOpen(true);
            }}
          >
            Editar
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(t)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="finance-disclaimer mb-4">
        Estas son estimaciones financieras / provisiones fiscales internas para planeacion - no constituyen una
        declaracion fiscal oficial ante el SAT.
      </div>
      <div className="page-header">
        <div />
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          Nueva provision
        </Button>
      </div>

      {taxProvisions.length === 0 ? (
        <EmptyState title="Sin provisiones fiscales" />
      ) : (
        <Table columns={columns} rows={taxProvisions} rowKey={(t) => t.id} />
      )}

      <TaxProvisionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        initialProvision={editing}
        submitting={submitting}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar provision fiscal"
        message={`Esto eliminara permanentemente la provision "${deleteTarget?.tax_type}" del periodo ${deleteTarget?.period}.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
