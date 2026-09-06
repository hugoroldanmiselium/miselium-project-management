import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Select, Textarea } from '../Input';
import type { Profile, Project, Task, TaskPriority, TaskStatus } from '../../types/database';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    description: string;
    project_id: string;
    assigned_to: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string | null;
  }) => Promise<void>;
  projects: Project[];
  profiles: Profile[];
  initialTask?: Task | null;
  lockedProjectId?: string;
  submitting?: boolean;
}

export function TaskFormModal({
  open,
  onClose,
  onSubmit,
  projects,
  profiles,
  initialTask,
  lockedProjectId,
  submitting,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(lockedProjectId ?? '');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialTask?.title ?? '');
      setDescription(initialTask?.description ?? '');
      setProjectId(initialTask?.project_id ?? lockedProjectId ?? projects[0]?.id ?? '');
      setAssignedTo(initialTask?.assigned_to ?? '');
      setPriority(initialTask?.priority ?? 'MEDIUM');
      setStatus(initialTask?.status ?? 'TODO');
      setDueDate(initialTask?.due_date ?? '');
      setError(null);
    }
  }, [open, initialTask, lockedProjectId, projects]);

  async function handleSubmit() {
    if (!title.trim()) {
      setError('El titulo es obligatorio.');
      return;
    }
    if (!projectId) {
      setError('Selecciona un proyecto.');
      return;
    }
    setError(null);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      project_id: projectId,
      assigned_to: assignedTo || null,
      priority,
      status,
      due_date: dueDate || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialTask ? 'Editar tarea' : 'Nueva tarea'}
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
      <Input label="Titulo" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Implementar login" />
      <Textarea
        label="Descripcion"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detalles de la tarea (opcional)"
      />
      <Select
        label="Proyecto"
        required
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        disabled={!!lockedProjectId}
      >
        <option value="">Selecciona un proyecto</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select label="Asignado a" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">Sin asignar</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <div className="two-col">
        <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          <option value="LOW">Baja</option>
          <option value="MEDIUM">Media</option>
          <option value="HIGH">Alta</option>
        </Select>
        <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          <option value="TODO">Pendiente</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="DONE">Completada</option>
        </Select>
      </div>
      <Input label="Fecha limite" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
