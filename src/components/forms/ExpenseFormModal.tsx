import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Select, Textarea } from '../Input';
import type { Expense, ExpenseStatus, FinanceCategory } from '../../types/database';

export interface ExpenseFormValues {
  date: string;
  concept: string;
  vendor: string | null;
  category_id: string | null;
  subtotal: number;
  iva: number;
  total: number;
  payment_method: string | null;
  status: ExpenseStatus;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
}

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues) => Promise<void>;
  onCreateCategory: (name: string) => Promise<FinanceCategory | null>;
  categories: FinanceCategory[];
  initialExpense?: Expense | null;
  submitting?: boolean;
}

export function ExpenseFormModal({
  open,
  onClose,
  onSubmit,
  onCreateCategory,
  categories,
  initialExpense,
  submitting,
}: ExpenseFormModalProps) {
  const [date, setDate] = useState('');
  const [concept, setConcept] = useState('');
  const [vendor, setVendor] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [iva, setIva] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('PENDIENTE');
  const [dueDate, setDueDate] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [notes, setNotes] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(initialExpense?.date ?? new Date().toISOString().slice(0, 10));
      setConcept(initialExpense?.concept ?? '');
      setVendor(initialExpense?.vendor ?? '');
      setCategoryId(initialExpense?.category_id ?? '');
      setSubtotal(initialExpense ? String(initialExpense.subtotal) : '');
      setIva(initialExpense ? String(initialExpense.iva) : '0');
      setPaymentMethod(initialExpense?.payment_method ?? '');
      setStatus(initialExpense?.status ?? 'PENDIENTE');
      setDueDate(initialExpense?.due_date ?? '');
      setPaidDate(initialExpense?.paid_date ?? '');
      setNotes(initialExpense?.notes ?? '');
      setAddingCategory(false);
      setNewCategoryName('');
      setError(null);
    }
  }, [open, initialExpense]);

  const total = Number(subtotal || 0) + Number(iva || 0);

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
      vendor: vendor.trim() || null,
      category_id: categoryId || null,
      subtotal: parsedSubtotal,
      iva: parsedIva,
      total: parsedSubtotal + parsedIva,
      payment_method: paymentMethod.trim() || null,
      status,
      due_date: dueDate || null,
      paid_date: status === 'PAGADO' ? paidDate || new Date().toISOString().slice(0, 10) : null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialExpense ? 'Editar egreso' : 'Nuevo egreso'}
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
        <Input label="Proveedor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Ej. AWS" />
      </div>
      <Input label="Concepto" required value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Hosting mensual" />

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
        <Input label="Metodo de pago" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Ej. Tarjeta" />
        <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)}>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
        </Select>
      </div>
      <div className="two-col">
        <Input label="Fecha de vencimiento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {status === 'PAGADO' && (
          <Input label="Fecha de pago" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        )}
      </div>
      <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
