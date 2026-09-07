import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Select, Textarea } from '../Input';
import type { Client, FinanceCategory, Income, IncomeStatus } from '../../types/database';

export interface IncomeFormValues {
  date: string;
  concept: string;
  client_id: string | null;
  category_id: string | null;
  subtotal: number;
  iva: number;
  total: number;
  payment_method: string | null;
  status: IncomeStatus;
  due_date: string | null;
  collected_date: string | null;
  notes: string | null;
}

interface IncomeFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: IncomeFormValues) => Promise<void>;
  onCreateCategory: (name: string) => Promise<FinanceCategory | null>;
  clients: Client[];
  categories: FinanceCategory[];
  initialIncome?: Income | null;
  submitting?: boolean;
}

export function IncomeFormModal({
  open,
  onClose,
  onSubmit,
  onCreateCategory,
  clients,
  categories,
  initialIncome,
  submitting,
}: IncomeFormModalProps) {
  const [date, setDate] = useState('');
  const [concept, setConcept] = useState('');
  const [clientId, setClientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [iva, setIva] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState<IncomeStatus>('PENDIENTE');
  const [dueDate, setDueDate] = useState('');
  const [collectedDate, setCollectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(initialIncome?.date ?? new Date().toISOString().slice(0, 10));
      setConcept(initialIncome?.concept ?? '');
      setClientId(initialIncome?.client_id ?? '');
      setCategoryId(initialIncome?.category_id ?? '');
      setSubtotal(initialIncome ? String(initialIncome.subtotal) : '');
      setIva(initialIncome ? String(initialIncome.iva) : '0');
      setPaymentMethod(initialIncome?.payment_method ?? '');
      setStatus(initialIncome?.status ?? 'PENDIENTE');
      setDueDate(initialIncome?.due_date ?? '');
      setCollectedDate(initialIncome?.collected_date ?? '');
      setNotes(initialIncome?.notes ?? '');
      setAddingCategory(false);
      setNewCategoryName('');
      setError(null);
    }
  }, [open, initialIncome]);

  const total = (Number(subtotal || 0) + Number(iva || 0));

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const created = await onCreateCategory(newCategoryName.trim());
    if (created) {
      setCategoryId(created.id);
      setAddingCategory(false);
      setNewCategoryName('');
    }
  }

  async function handleSubmit() {
    if (!concept.trim()) {
      setError('El concepto es obligatorio.');
      return;
    }
    if (!date) {
      setError('La fecha es obligatoria.');
      return;
    }
    const parsedSubtotal = Number(subtotal);
    if (!subtotal.trim() || !Number.isFinite(parsedSubtotal) || parsedSubtotal < 0) {
      setError('El subtotal debe ser un numero valido.');
      return;
    }
    const parsedIva = Number(iva || 0);
    if (!Number.isFinite(parsedIva) || parsedIva < 0) {
      setError('El IVA debe ser un numero valido.');
      return;
    }
    setError(null);
    await onSubmit({
      date,
      concept: concept.trim(),
      client_id: clientId || null,
      category_id: categoryId || null,
      subtotal: parsedSubtotal,
      iva: parsedIva,
      total: parsedSubtotal + parsedIva,
      payment_method: paymentMethod.trim() || null,
      status,
      due_date: dueDate || null,
      collected_date: status === 'COBRADO' ? collectedDate || new Date().toISOString().slice(0, 10) : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialIncome ? 'Editar ingreso' : 'Nuevo ingreso'}
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
      <div className="two-col">
        <Input label="Fecha" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Sin cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <Input label="Concepto" required value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Proyecto sitio web" />

      {!addingCategory ? (
        <div className="field">
          <label className="field-label">Categoria</label>
          <div className="flex items-center gap-2">
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Sin categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setAddingCategory(true)}>
              Nueva
            </Button>
          </div>
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Nueva categoria</label>
          <div className="flex items-center gap-2">
            <input
              className="input"
              style={{ flex: 1 }}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nombre de la categoria"
            />
            <Button variant="secondary" onClick={handleAddCategory}>
              Agregar
            </Button>
            <Button variant="secondary" onClick={() => setAddingCategory(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="two-col">
        <Input label="Subtotal" required type="number" min="0" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
        <Input label="IVA" type="number" min="0" step="0.01" value={iva} onChange={(e) => setIva(e.target.value)} />
      </div>
      <Input label="Total" value={total.toFixed(2)} disabled hint="Subtotal + IVA, calculado automaticamente." />
      <div className="two-col">
        <Input label="Metodo de pago" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Ej. Transferencia" />
        <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as IncomeStatus)}>
          <option value="PENDIENTE">Pendiente</option>
          <option value="COBRADO">Cobrado</option>
        </Select>
      </div>
      <div className="two-col">
        <Input label="Fecha de vencimiento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {status === 'COBRADO' && (
          <Input label="Fecha de cobro" type="date" value={collectedDate} onChange={(e) => setCollectedDate(e.target.value)} />
        )}
      </div>
      <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
