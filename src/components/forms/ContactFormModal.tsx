import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Textarea } from '../Input';
import type { Contact } from '../../types/database';

export interface ContactFormValues {
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: string | null;
  potential_value: number | null;
  notes: string | null;
}

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ContactFormValues) => Promise<void>;
  initialContact?: Contact | null;
  submitting?: boolean;
}

export function ContactFormModal({ open, onClose, onSubmit, initialContact, submitting }: ContactFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [potentialValue, setPotentialValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialContact?.name ?? '');
      setPhone(initialContact?.phone ?? '');
      setWhatsapp(initialContact?.whatsapp ?? '');
      setEmail(initialContact?.email ?? '');
      setCompany(initialContact?.company ?? '');
      setPotentialValue(initialContact?.potential_value != null ? String(initialContact.potential_value) : '');
      setNotes(initialContact?.notes ?? '');
      setError(null);
    }
  }, [open, initialContact]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    let parsedValue: number | null = null;
    if (potentialValue.trim()) {
      parsedValue = Number(potentialValue);
      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        setError('El valor comercial potencial debe ser un numero valido.');
        return;
      }
    }
    setError(null);
    await onSubmit({
      name: name.trim(),
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: email.trim() || null,
      company: company.trim() || null,
      potential_value: parsedValue,
      notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialContact ? 'Editar contacto' : 'Nuevo contacto'}
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
      <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Perez" />
      <Input label="Empresa / actividad" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ej. Constructora ABC" />
      <div className="two-col">
        <Input label="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 5512345678" />
        <Input label="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Ej. 5512345678" />
      </div>
      <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input
        label="Valor comercial potencial"
        type="number"
        min="0"
        step="0.01"
        value={potentialValue}
        onChange={(e) => setPotentialValue(e.target.value)}
        placeholder="Ej. 50000"
        hint="Estimado de oportunidad, no un ingreso real. No se integra a Finanzas."
      />
      <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
