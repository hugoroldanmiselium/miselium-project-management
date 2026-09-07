import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Textarea } from '../Input';

export interface RegisterContactValues {
  note: string;
  next_followup_at: string | null;
}

interface RegisterContactModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: RegisterContactValues) => Promise<void>;
  contactName?: string;
  submitting?: boolean;
}

/**
 * "Registrar contacto" (spec section 7) - the minimal-clicks quick action:
 * a single compact form that logs one interaction note and optionally moves
 * next_followup_at in the same submission. Saving updates
 * contacts.last_contact_date to today, inserts a contact_interactions row,
 * and optionally updates next_followup_at - all from one form, no multi-step
 * wizard.
 */
export function RegisterContactModal({ open, onClose, onSubmit, contactName, submitting }: RegisterContactModalProps) {
  const [note, setNote] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setNextFollowup('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!note.trim()) {
      setError('Agrega una nota breve sobre el contacto.');
      return;
    }
    setError(null);
    let iso: string | null = null;
    if (nextFollowup) {
      const d = new Date(nextFollowup);
      iso = Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    await onSubmit({ note: note.trim(), next_followup_at: iso });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contactName ? `Registrar contacto — ${contactName}` : 'Registrar contacto'}
      maxWidth={440}
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
      <p className="text-small text-muted mb-3">
        Marca la fecha de ultimo contacto como hoy y guarda una nota breve. Opcionalmente, fija el proximo seguimiento.
      </p>
      <Textarea
        label="Nota"
        required
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ej. Llame, interesado en cotizacion..."
        autoFocus
      />
      <Input
        label="Proximo seguimiento (opcional)"
        type="datetime-local"
        value={nextFollowup}
        onChange={(e) => setNextFollowup(e.target.value)}
      />
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
