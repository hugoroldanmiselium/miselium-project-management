import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Select, Textarea } from '../Input';
import type { Client, Project, ProjectStatus } from '../../types/database';

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    description: string;
    client_id: string | null;
    status: ProjectStatus;
    start_date: string | null;
    due_date: string | null;
  }) => Promise<void>;
  clients: Client[];
  initialProject?: Project | null;
  submitting?: boolean;
}

export function ProjectFormModal({ open, onClose, onSubmit, clients, initialProject, submitting }: ProjectFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PLANNING');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialProject?.name ?? '');
      setDescription(initialProject?.description ?? '');
      setClientId(initialProject?.client_id ?? '');
      setStatus(initialProject?.status ?? 'PLANNING');
      setStartDate(initialProject?.start_date ?? '');
      setDueDate(initialProject?.due_date ?? '');
      setError(null);
    }
  }, [open, initialProject]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      client_id: clientId || null,
      status,
      start_date: startDate || null,
      due_date: dueDate || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialProject ? 'Editar proyecto' : 'Nuevo proyecto'}
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
      <Input label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Sitio web ALTUM" />
      <Textarea label="Descripcion" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
        <option value="">Sin cliente</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
        <option value="PLANNING">Planeacion</option>
        <option value="ACTIVE">Activo</option>
        <option value="ON_HOLD">En pausa</option>
        <option value="COMPLETED">Completado</option>
      </Select>
      <div className="two-col">
        <Input label="Fecha de inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="Fecha limite" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
