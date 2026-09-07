import type { ReactNode } from 'react';

export type SemanticColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';

interface BadgeProps {
  color: SemanticColor;
  children: ReactNode;
}

export function Badge({ color, children }: BadgeProps) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

export function StatusIndicator({ color, label }: { color: SemanticColor; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`status-dot status-dot-${color}`} />
      <span>{label}</span>
    </span>
  );
}

// ===== Domain-specific color mappings =====

export function projectStatusColor(status: string): SemanticColor {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'PLANNING':
      return 'blue';
    case 'ON_HOLD':
      return 'yellow';
    case 'COMPLETED':
      return 'purple';
    default:
      return 'gray';
  }
}

export function projectStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Activo';
    case 'PLANNING':
      return 'Planeacion';
    case 'ON_HOLD':
      return 'En pausa';
    case 'COMPLETED':
      return 'Completado';
    default:
      return status;
  }
}

export function taskStatusColor(status: string): SemanticColor {
  switch (status) {
    case 'DONE':
      return 'green';
    case 'IN_PROGRESS':
      return 'yellow';
    case 'TODO':
      return 'blue';
    default:
      return 'gray';
  }
}

export function taskStatusLabel(status: string): string {
  switch (status) {
    case 'DONE':
      return 'Completada';
    case 'IN_PROGRESS':
      return 'En progreso';
    case 'TODO':
      return 'Pendiente';
    default:
      return status;
  }
}

export function priorityColor(priority: string): SemanticColor {
  switch (priority) {
    case 'HIGH':
      return 'red';
    case 'MEDIUM':
      return 'yellow';
    case 'LOW':
      return 'gray';
    default:
      return 'gray';
  }
}

export function priorityLabel(priority: string): string {
  switch (priority) {
    case 'HIGH':
      return 'Alta';
    case 'MEDIUM':
      return 'Media';
    case 'LOW':
      return 'Baja';
    default:
      return priority;
  }
}

export function roleColor(role: string): SemanticColor {
  switch (role) {
    case 'ADMIN':
      return 'purple';
    case 'PROJECT_MANAGER':
      return 'yellow';
    case 'COLLABORATOR':
      return 'blue';
    default:
      return 'gray';
  }
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'DONE') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export function occurrenceStatusColor(status: string): SemanticColor {
  switch (status) {
    case 'DONE':
      return 'green';
    case 'IN_PROGRESS':
      return 'yellow';
    case 'SKIPPED':
      return 'gray';
    case 'PENDING':
      return 'blue';
    default:
      return 'gray';
  }
}

export function followupStatusColor(status: string): SemanticColor {
  switch (status) {
    case 'OVERDUE':
      return 'red';
    case 'TODAY':
      return 'yellow';
    case 'UPCOMING':
      return 'green';
    case 'NONE':
      return 'gray';
    default:
      return 'gray';
  }
}

export function occurrenceStatusLabel(status: string): string {
  switch (status) {
    case 'DONE':
      return 'Completada';
    case 'IN_PROGRESS':
      return 'En progreso';
    case 'SKIPPED':
      return 'Omitida';
    case 'PENDING':
      return 'Pendiente';
    default:
      return status;
  }
}
