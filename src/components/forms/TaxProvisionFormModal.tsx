import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Select, Textarea } from '../Input';
import type { TaxProvision, TaxProvisionStatus } from '../../types/database';

export interface TaxProvisionFormValues {
  date: string;
  tax_type: string;
  period: string;
  base: number | null;
  iva_trasladado: number | null;
  iva_acreditable: number | null;
  iva_por_pagar: number | null;
  isr_estimado: number | null;
  total_provisioned: number;
  total_paid: number | null;
  status: TaxProvisionStatus;
  notes: string | null;
}

interface TaxProvisionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: TaxProvisionFormValues) => Promise<void>;
  initialProvision?: TaxProvision | null;
  submitting?: boolean;
}

function numOrEmpty(v: number | null | undefined): string {
  return v != null ? String(v) : '';
}

export function TaxProvisionFormModal({ open, onClose, onSubmit, initialProvision, submitting }: TaxProvisionFormModalProps) {
  const [date, setDate] = useState('');
  const [taxType, setTaxType] = useState('');
  const [period, setPeriod] = useState('');
  const [base, setBase] = useState('');
  const [ivaTrasladado, setIvaTrasladado] = useState('');
  const [ivaAcreditable, setIvaAcreditable] = useState('');
  const [ivaPorPagar, setIvaPorPagar] = useState('');
  const [isrEstimado, setIsrEstimado] = useState('');
  const [totalProvisioned, setTotalProvisioned] = useState('');
  const [totalPaid, setTotalPaid] = useState('0');
  const [status, setStatus] = useState<TaxProvisionStatus>('PENDIENTE');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const today = new Date();
      setDate(initialProvision?.date ?? today.toISOString().slice(0, 10));
      setTaxType(initialProvision?.tax_type ?? '');
      setPeriod(initialProvision?.period ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
      setBase(numOrEmpty(initialProvision?.base));
      setIvaTrasladado(numOrEmpty(initialProvision?.iva_trasladado));
      setIvaAcreditable(numOrEmpty(initialProvision?.iva_acreditable));
      setIvaPorPagar(numOrEmpty(initialProvision?.iva_por_pagar));
      setIsrEstimado(numOrEmpty(initialProvision?.isr_estimado));
      setTotalProvisioned(initialProvision ? String(initialProvision.total_provisioned) : '');
      setTotalPaid(numOrEmpty(initialProvision?.total_paid) || '0');
      setStatus(initialProvision?.status ?? 'PENDIENTE');
      setNotes(initialProvision?.notes ?? '');
      setError(null);
    }
  }, [open, initialProvision]);

  function parseOptional(v: string): number | null {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit() {
    if (!taxType.trim()) {
      setError('El tipo de impuesto es obligatorio.');
      return;
    }
    if (!period.trim()) {
      setError('El periodo es obligatorio.');
      return;
    }
    const parsedTotal = Number(totalProvisioned);
    if (!totalProvisioned.trim() || !Number.isFinite(parsedTotal) || parsedTotal < 0) {
      setError('El total provisionado debe ser un numero valido.');
      return;
    }
    setError(null);
    await onSubmit({
      date,
      tax_type: taxType.trim(),
      period: period.trim(),
      base: parseOptional(base),
      iva_trasladado: parseOptional(ivaTrasladado),
      iva_acreditable: parseOptional(ivaAcreditable),
      iva_por_pagar: parseOptional(ivaPorPagar),
      isr_estimado: parseOptional(isrEstimado),
      total_provisioned: parsedTotal,
      total_paid: parseOptional(totalPaid) ?? 0,
      status,
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialProvision ? 'Editar provision fiscal' : 'Nueva provision fiscal'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="finance-disclaimer">
        Estimacion financiera / provision fiscal interna - no constituye una declaracion fiscal oficial.
      </div>
      <div className="two-col">
        <Input label="Fecha" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Periodo" required value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ej. 2026-09" />
      </div>
      <Input label="Tipo de impuesto" required value={taxType} onChange={(e) => setTaxType(e.target.value)} placeholder="Ej. IVA mensual" />
      <div className="two-col">
        <Input label="Base" type="number" step="0.01" value={base} onChange={(e) => setBase(e.target.value)} />
        <Input label="ISR estimado" type="number" step="0.01" value={isrEstimado} onChange={(e) => setIsrEstimado(e.target.value)} />
      </div>
      <div className="two-col">
        <Input label="IVA trasladado" type="number" step="0.01" value={ivaTrasladado} onChange={(e) => setIvaTrasladado(e.target.value)} />
        <Input label="IVA acreditable" type="number" step="0.01" value={ivaAcreditable} onChange={(e) => setIvaAcreditable(e.target.value)} />
      </div>
      <Input label="IVA por pagar" type="number" step="0.01" value={ivaPorPagar} onChange={(e) => setIvaPorPagar(e.target.value)} />
      <div className="two-col">
        <Input
          label="Total provisionado"
          required
          type="number"
          min="0"
          step="0.01"
          value={totalProvisioned}
          onChange={(e) => setTotalProvisioned(e.target.value)}
        />
        <Input label="Total pagado" type="number" min="0" step="0.01" value={totalPaid} onChange={(e) => setTotalPaid(e.target.value)} />
      </div>
      <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as TaxProvisionStatus)}>
        <option value="PENDIENTE">Pendiente</option>
        <option value="PAGADO">Pagado</option>
      </Select>
      <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
