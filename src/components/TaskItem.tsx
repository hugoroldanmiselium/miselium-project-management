import { Calendar, Clock, Target } from 'lucide-react';
import type { Task } from '../types/database';
import { Badge, isOverdue, priorityColor, priorityLabel, taskStatusColor, taskStatusLabel } from './Badge';

interface TaskItemProps {
  task: Task;
  projectName?: string;
  assigneeName?: string;
  onStatusChange?: (status: Task['status']) => void;
  showProject?: boolean;
  loggedHours?: number;
  onClick?: () => void;
}

export function TaskItem({ task, projectName, assigneeName, onStatusChange, showProject, loggedHours, onClick }: TaskItemProps) {
  const overdue = isOverdue(task.due_date, task.status);
  return (
    <div className={`task-item ${onClick ? 'task-item-clickable' : ''}`} onClick={onClick}>
      <div className="task-item-main">
        <div className="task-item-title">{task.title}</div>
        <div className="task-item-meta">
          {showProject && projectName && <span>{projectName}</span>}
          {assigneeName && <span>· {assigneeName}</span>}
          {task.due_date && (
            <span className="flex items-center gap-1" style={overdue ? { color: 'var(--color-red-text)' } : undefined}>
              <Calendar size={12} /> {task.due_date}
            </span>
          )}
          {!!loggedHours && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> {loggedHours}h registradas
            </span>
          )}
          {task.estimated_hours != null && (
            <span className="flex items-center gap-1">
              <Target size={12} /> {task.estimated_hours}h estimadas
            </span>
          )}
        </div>
      </div>
      <Badge color={priorityColor(task.priority)}>{priorityLabel(task.priority)}</Badge>
      {overdue ? (
        <Badge color="red">Vencida</Badge>
      ) : (
        <Badge color={taskStatusColor(task.status)}>{taskStatusLabel(task.status)}</Badge>
      )}
      {onStatusChange && (
        <select
          className="select-inline"
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value as Task['status'])}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="TODO">Pendiente</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="DONE">Completada</option>
        </select>
      )}
    </div>
  );
}
