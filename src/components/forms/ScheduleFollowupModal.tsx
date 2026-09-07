import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { isoToDatetimeLocal, datetimeLocalToIso } from '../../lib/crmUtils';

interface ScheduleFollowupModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (nextFollowupAt: string | null) => Promise<void>;
  contactName?: string;
  currentValue: string | null;
  submitting?: boolean;
}

/**
 * "Programar seguimiento" (spec section 9) - a lighter action than
 * "Registrar contacto": just move/clear next_followup_at, no note required.
 */
export function ScheduleFollowupModal({ open, onClose, onSubmit, contactName, currentValue, submitting }: ScheduleFollowupModalProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue(isoToDatetimeLocal(currentValue));
  }, [open, currentValue]);

  async function handleSubmit() {
    await onSubmit(datetimeLocalToIso(value));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contactName ? `Programar seguimiento — ${contactName}` : 'Programar seguimiento'}
      maxWidth={400}
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
      <Input
        label="Proximo seguimiento"
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint="Deja vacio para quitar el seguimiento programado."
        autoFocus
      />
    </Modal>
  );
}
