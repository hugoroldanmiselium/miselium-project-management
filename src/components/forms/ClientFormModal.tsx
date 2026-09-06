import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Textarea } from '../Input';
import type { Client } from '../../types/database';

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; contact_name: string; email: string; phone: string; notes: string }) => Promise<void>;
  initialClient?: Client | null;
  submitting?: boolean;
}

export function ClientFormModal({ open, onClose, onSubmit, initialClient, submitting }: ClientFormModalProps) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialClient?.name ?? '');
      setContactName(initialClient?.contact_name ?? '');
      setEmail(initialClient?.email ?? '');
      setPhone(initialClient?.phone ?? '');
      setNotes(initialClient?.notes ?? '');
      setError(null);
    }
  }, [open, initialClient]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit({
      name: name.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialClient ? 'Editar cliente' : 'Nuevo cliente'}
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
      <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. ALTUM" />
      <Input label="Contacto" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre del contacto" />
      <div className="two-col">
        <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
