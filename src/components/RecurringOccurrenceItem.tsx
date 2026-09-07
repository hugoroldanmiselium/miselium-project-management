import { Clock, Repeat, Target } from 'lucide-react';
import { Badge, occurrenceStatusColor, occurrenceStatusLabel, priorityColor, priorityLabel } from './Badge';
import type { OccurrenceStatus } from '../types/database';
import type { OccurrenceView } from '../lib/occurrences';

interface RecurringOccurrenceItemProps {
  view: OccurrenceView;
  projectName?: string;
  clientName?: string;
  onStatusChange?: (status: OccurrenceStatus) => void;
}

export function RecurringOccurrenceItem({ view, projectName, clientName, onStatusChange }: RecurringOccurrenceItemProps) {
  const { recurringTask, status } = view;
  return (
    <div className="task-item">
      <div className="task-item-main">
        <div className="task-item-title flex items-center gap-2">
          {recurringTask.name}
          <span className="badge badge-purple" title="Tarea recurrente semanal">
            <Repeat size={11} style={{ verticalAlign: -1 }} /> Recurrente
          </span>
        </div>
        <div className="task-item-meta">
          {projectName && <span>{projectName}</span>}
          {clientName && <span>· {clientName}</span>}
          {recurringTask.time_of_day && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> {recurringTask.time_of_day.slice(0, 5)}
            </span>
          )}
          {recurringTask.estimated_hours != null && (
            <span className="flex items-center gap-1">
              <Target size={12} /> {recurringTask.estimated_hours}h estimadas
            </span>
          )}
        </div>
      </div>
      <Badge color={priorityColor(recurringTask.priority)}>{priorityLabel(recurringTask.priority)}</Badge>
      <Badge color={occurrenceStatusColor(status)}>{occurrenceStatusLabel(status)}</Badge>
      {onStatusChange && (
        <select
          className="select-inline"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as OccurrenceStatus)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="PENDING">Pendiente</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="DONE">Completada</option>
          <option value="SKIPPED">Omitida</option>
        </select>
      )}
    </div>
  );
}
