import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Select, Textarea } from '../Input';
import { WEEKDAYS, WEEKDAY_LABELS, todayDateStr } from '../../lib/recurringDates';
import type { Client, Profile, Project, RecurringTask, TaskPriority, Weekday } from '../../types/database';

export interface RecurringTaskFormValues {
  name: string;
  description: string;
  assignee_id: string | null;
  weekday: Weekday;
  time_of_day: string | null;
  estimated_hours: number | null;
  priority: TaskPriority;
  category: string;
  client_id: string | null;
  project_id: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
}

interface RecurringTaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: RecurringTaskFormValues) => Promise<void>;
  profiles: Profile[];
  clients: Client[];
  projects: Project[];
  initialTask?: RecurringTask | null;
  submitting?: boolean;
}

export function RecurringTaskFormModal({
  open,
  onClose,
  onSubmit,
  profiles,
  clients,
  projects,
  initialTask,
  submitting,
}: RecurringTaskFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [weekday, setWeekday] = useState<Weekday>('MON');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [category, setCategory] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState(todayDateStr());
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialTask?.name ?? '');
      setDescription(initialTask?.description ?? '');
      setAssigneeId(initialTask?.assignee_id ?? '');
      setWeekday(initialTask?.weekday ?? 'MON');
      setTimeOfDay(initialTask?.time_of_day?.slice(0, 5) ?? '');
      setEstimatedHours(initialTask?.estimated_hours != null ? String(initialTask.estimated_hours) : '');
      setPriority(initialTask?.priority ?? 'MEDIUM');
      setCategory(initialTask?.category ?? '');
      setClientId(initialTask?.client_id ?? '');
      setProjectId(initialTask?.project_id ?? '');
      setStartDate(initialTask?.start_date ?? todayDateStr());
      setEndDate(initialTask?.end_date ?? '');
      setActive(initialTask?.active ?? true);
      setError(null);
    }
  }, [open, initialTask]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!startDate) {
      setError('La fecha de inicio es obligatoria.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('La fecha de finalizacion no puede ser anterior a la fecha de inicio.');
      return;
    }
    const trimmedEstimate = estimatedHours.trim();
    let parsedEstimate: number | null = null;
    if (trimmedEstimate) {
      parsedEstimate = Number(trimmedEstimate);
      if (!Number.isFinite(parsedEstimate) || parsedEstimate < 0) {
        setError('Las horas estimadas deben ser un numero valido.');
        return;
      }
    }
    setError(null);
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      assignee_id: assigneeId || null,
      weekday,
      time_of_day: timeOfDay || null,
      estimated_hours: parsedEstimate,
      priority,
      category: category.trim(),
      client_id: clientId || null,
      project_id: projectId || null,
      start_date: startDate,
      end_date: endDate || null,
      active,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialTask ? 'Editar tarea recurrente' : 'Nueva tarea recurrente'}
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
        label="Nombre"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ej. Revision semanal de proyectos"
      />
      <Textarea
        label="Descripcion"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detalles de la tarea (opcional)"
      />
      <Select label="Responsable" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
        <option value="">Sin asignar</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <div className="two-col">
        <Select label="Dia de la semana" required value={weekday} onChange={(e) => setWeekday(e.target.value as Weekday)}>
          {WEEKDAYS.map((w) => (
            <option key={w} value={w}>
              {WEEKDAY_LABELS[w]}
            </option>
          ))}
        </Select>
        <Input label="Hora (opcional)" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
      </div>
      <div className="two-col">
        <Input
          label="Horas estimadas"
          type="number"
          min="0"
          step="0.5"
          max="999.99"
          placeholder="Ej. 1"
          value={estimatedHours}
          onChange={(e) => setEstimatedHours(e.target.value)}
        />
        <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          <option value="LOW">Baja</option>
          <option value="MEDIUM">Media</option>
          <option value="HIGH">Alta</option>
        </Select>
      </div>
      <Input label="Categoria (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej. Administrativo" />
      <div className="two-col">
        <Select label="Cliente (opcional)" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Sin cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Proyecto (opcional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Sin proyecto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="two-col">
        <Input label="Fecha de inicio" required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="Fecha de finalizacion (opcional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <label className="flex items-center gap-2" style={{ marginTop: 4, cursor: 'pointer' }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span className="text-body">Activa (genera ocurrencias)</span>
      </label>
      {error && <div className="field-error">{error}</div>}
    </Modal>
  );
}
