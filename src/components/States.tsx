import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Lock, SearchX } from 'lucide-react';

export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className="state-block">
      <span className="spinner" />
      <span className="text-small text-muted">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state-block">
      <div className="state-block-icon">{icon ?? <Inbox size={28} />}</div>
      <div className="state-block-title">{title}</div>
      {description && <div className="state-block-desc">{description}</div>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Algo salio mal',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block">
      <div className="state-block-icon" style={{ color: 'var(--color-red-text)' }}>
        <AlertTriangle size={28} />
      </div>
      <div className="state-block-title">{title}</div>
      {description && <div className="state-block-desc">{description}</div>}
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function UnauthorizedState() {
  return (
    <div className="state-block">
      <div className="state-block-icon">
        <Lock size={28} />
      </div>
      <div className="state-block-title">No tienes acceso a esta seccion</div>
      <div className="state-block-desc">
        Tu rol actual no tiene permisos para ver este contenido.
      </div>
    </div>
  );
}

export function NotFoundState({ label = 'No se encontro el recurso' }: { label?: string }) {
  return (
    <div className="state-block">
      <div className="state-block-icon">
        <SearchX size={28} />
      </div>
      <div className="state-block-title">{label}</div>
    </div>
  );
}
