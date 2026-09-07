import { useState } from 'react';
import { Phone, MessageCircle, Mail, Pencil, Trash2, CalendarClock, PhoneCall } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { LoadingState, EmptyState } from './States';
import { Badge, followupStatusColor } from './Badge';
import { RegisterContactModal, type RegisterContactValues } from './forms/RegisterContactModal';
import { ScheduleFollowupModal } from './forms/ScheduleFollowupModal';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchInteractionsForContact, createContactInteraction, updateContact } from '../lib/queries';
import { followupStatus, FOLLOWUP_STATUS_LABEL, formatFollowup } from '../lib/crmUtils';
import { todayDateStr } from '../lib/recurringDates';
import { formatMXN } from '../lib/financeUtils';
import type { Contact, Profile } from '../types/database';

interface ContactDetailModalProps {
  open: boolean;
  onClose: () => void;
  contact: Contact | null;
  profiles: Profile[];
  onChanged?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ContactDetailModal({ open, onClose, contact, profiles, onChanged, onEdit, onDelete }: ContactDetailModalProps) {
  const { profile, canManage } = useAuth();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: interactions,
    loading: interactionsLoading,
    refetch: refetchInteractions,
  } = useSupabaseQuery(
    () => (contact ? fetchInteractionsForContact(contact.id) : Promise.resolve({ data: [], error: null })),
    [contact?.id, open]
  );

  const profileMap = new Map(profiles.map((p) => [p.id, p.name]));

  if (!contact) return null;

  const status = followupStatus(contact.next_followup_at);

  async function handleRegister(values: RegisterContactValues) {
    if (!contact || !profile) return;
    setSubmitting(true);
    await Promise.all([
      updateContact(contact.id, {
        last_contact_date: todayDateStr(),
        next_followup_at: values.next_followup_at ?? contact.next_followup_at,
        updated_by: profile.id,
      }),
      createContactInteraction({ contact_id: contact.id, note: values.note, user_id: profile.id }),
    ]);
    setSubmitting(false);
    setRegisterOpen(false);
    refetchInteractions();
    onChanged?.();
  }

  async function handleSchedule(nextFollowupAt: string | null) {
    if (!contact || !profile) return;
    setSubmitting(true);
    await updateContact(contact.id, { next_followup_at: nextFollowupAt, updated_by: profile.id });
    setSubmitting(false);
    setScheduleOpen(false);
    onChanged?.();
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={contact.name} maxWidth={560}>
        <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          <Badge color={followupStatusColor(status)}>{FOLLOWUP_STATUS_LABEL[status]}</Badge>
          {contact.company && <span className="text-small text-muted">{contact.company}</span>}
        </div>

        <div className="two-col mb-4">
          <div>
            <div className="text-small text-muted mb-1">Valor comercial potencial</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>
              {contact.potential_value != null ? formatMXN(Number(contact.potential_value)) : '—'}
            </div>
          </div>
          <div>
            <div className="text-small text-muted mb-1">Proximo seguimiento</div>
            <div style={{ fontWeight: 500 }}>{formatFollowup(contact.next_followup_at)}</div>
          </div>
        </div>

        <div className="text-small text-muted mb-4">Ultimo contacto — {contact.last_contact_date ?? 'Nunca'}</div>

        <div className="flex flex-col gap-2 mb-4">
          {contact.phone && (
            <a className="flex items-center gap-2 text-body" href={`tel:${contact.phone}`}>
              <Phone size={14} className="text-muted" /> {contact.phone}
            </a>
          )}
          {contact.whatsapp && (
            <a
              className="flex items-center gap-2 text-body"
              href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={14} className="text-muted" /> {contact.whatsapp}
            </a>
          )}
          {contact.email && (
            <a className="flex items-center gap-2 text-body" href={`mailto:${contact.email}`}>
              <Mail size={14} className="text-muted" /> {contact.email}
            </a>
          )}
          {!contact.phone && !contact.whatsapp && !contact.email && (
            <span className="text-small text-muted">Sin datos de contacto.</span>
          )}
        </div>

        {contact.notes && (
          <div className="mb-4">
            <div className="text-small text-muted mb-1">Notas</div>
            <p className="text-body text-secondary">{contact.notes}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mb-6" style={{ flexWrap: 'wrap' }}>
          <Button variant="primary" size="sm" icon={<PhoneCall size={14} />} onClick={() => setRegisterOpen(true)}>
            Registrar contacto
          </Button>
          <Button variant="secondary" size="sm" icon={<CalendarClock size={14} />} onClick={() => setScheduleOpen(true)}>
            Programar seguimiento
          </Button>
          {canManage && onEdit && (
            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={onEdit}>
              Editar
            </Button>
          )}
          {canManage && onDelete && (
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={onDelete}>
              Eliminar
            </Button>
          )}
        </div>

        <div className="task-detail-section">
          <h3 className="mb-2" style={{ fontSize: 14 }}>
            Historial
          </h3>
          {interactionsLoading ? (
            <LoadingState label="Cargando historial..." />
          ) : (interactions ?? []).length === 0 ? (
            <EmptyState title="Sin historial" description="Aun no se ha registrado ningun contacto." />
          ) : (
            <div className="flex flex-col gap-3">
              {(interactions ?? []).map((i) => (
                <div key={i.id} className="comment-row">
                  <div className="avatar">{(profileMap.get(i.user_id) ?? '?').slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div className="text-small" style={{ fontWeight: 500 }}>
                      {profileMap.get(i.user_id) ?? 'Usuario'}{' '}
                      <span className="text-muted" style={{ fontWeight: 400 }}>
                        · {new Date(i.created_at).toLocaleString('es-MX')}
                      </span>
                    </div>
                    <div className="text-body">{i.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <RegisterContactModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSubmit={handleRegister}
        contactName={contact.name}
        submitting={submitting}
      />
      <ScheduleFollowupModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSubmit={handleSchedule}
        contactName={contact.name}
        currentValue={contact.next_followup_at}
        submitting={submitting}
      />
    </>
  );
}
