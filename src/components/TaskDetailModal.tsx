import { useMemo, useState } from 'react';
import { Clock, Send } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, Select, Textarea } from './Input';
import { LoadingState, EmptyState } from './States';
import { Badge, isOverdue, priorityColor, priorityLabel, taskStatusColor, taskStatusLabel } from './Badge';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import {
  createComment,
  createTimeEntry,
  fetchCommentsForTask,
  fetchTimeEntriesForTask,
  updateTaskStatus,
} from '../lib/queries';
import type { Profile, Task, TaskStatus } from '../types/database';

interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  projectName?: string;
  assigneeName?: string;
  profiles: Profile[];
  onChanged?: () => void;
}

export function TaskDetailModal({ open, onClose, task, projectName, assigneeName, profiles, onChanged }: TaskDetailModalProps) {
  const { profile, isAdmin } = useAuth();
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const {
    data: timeEntries,
    loading: timeLoading,
    refetch: refetchTime,
  } = useSupabaseQuery(
    () => (task ? fetchTimeEntriesForTask(task.id) : Promise.resolve({ data: [], error: null })),
    [task?.id, open]
  );

  const {
    data: comments,
    loading: commentsLoading,
    refetch: refetchComments,
  } = useSupabaseQuery(
    () => (task ? fetchCommentsForTask(task.id) : Promise.resolve({ data: [], error: null })),
    [task?.id, open]
  );

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.name])), [profiles]);
  const totalHours = useMemo(
    () => (timeEntries ?? []).reduce((sum, e) => sum + Number(e.hours), 0),
    [timeEntries]
  );

  const canLogTime = !!task && !!profile && (isAdmin || task.assigned_to === profile.id);

  if (!task) return null;

  const overdue = isOverdue(task.due_date, task.status);

  async function handleStatusChange(status: TaskStatus) {
    if (!task) return;
    await updateTaskStatus(task.id, status);
    onChanged?.();
  }

  async function handleLogTime() {
    if (!task || !profile) return;
    const parsed = Number(hours);
    if (!parsed || parsed <= 0) return;
    setLogSubmitting(true);
    await createTimeEntry({
      task_id: task.id,
      user_id: profile.id,
      hours: parsed,
      note: note.trim() || null,
      entry_date: entryDate,
    });
    setLogSubmitting(false);
    setHours('');
    setNote('');
    refetchTime();
    onChanged?.();
  }

  async function handleAddComment() {
    if (!task || !profile || !commentBody.trim()) return;
    setCommentSubmitting(true);
    await createComment({ task_id: task.id, user_id: profile.id, body: commentBody.trim() });
    setCommentSubmitting(false);
    setCommentBody('');
    refetchComments();
  }

  const canEditStatus = isAdmin || task.assigned_to === profile?.id;

  return (
    <Modal open={open} onClose={onClose} title={task.title} maxWidth={560}>
      <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        {overdue ? <Badge color="red">Vencida</Badge> : <Badge color={taskStatusColor(task.status)}>{taskStatusLabel(task.status)}</Badge>}
        <Badge color={priorityColor(task.priority)}>{priorityLabel(task.priority)}</Badge>
        {projectName && <span className="text-small text-muted">{projectName}</span>}
        {assigneeName && <span className="text-small text-muted">· {assigneeName}</span>}
        {task.due_date && <span className="text-small text-muted">· vence {task.due_date}</span>}
      </div>

      {task.description && <p className="text-body text-secondary mb-4">{task.description}</p>}

      {canEditStatus && (
        <div className="field mb-4">
          <label className="field-label">Estado</label>
          <Select value={task.status} onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}>
            <option value="TODO">Pendiente</option>
            <option value="IN_PROGRESS">En progreso</option>
            <option value="DONE">Completada</option>
          </Select>
        </div>
      )}

      <div className="task-detail-section">
        <h3 className="mb-2" style={{ fontSize: 14 }}>
          Tiempo registrado {totalHours > 0 && <span className="text-muted">· {totalHours}h total</span>}
        </h3>
        {timeLoading ? (
          <LoadingState label="Cargando tiempo..." />
        ) : (timeEntries ?? []).length === 0 ? (
          <div className="text-small text-muted mb-3">Sin horas registradas todavia.</div>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {(timeEntries ?? []).map((e) => (
              <div key={e.id} className="time-entry-row">
                <Clock size={13} className="text-muted" />
                <span style={{ fontWeight: 500 }}>{e.hours}h</span>
                <span className="text-muted">· {profileMap.get(e.user_id) ?? 'Usuario'}</span>
                <span className="text-muted">· {e.entry_date}</span>
                {e.note && <span className="text-muted">· {e.note}</span>}
              </div>
            ))}
          </div>
        )}
        {canLogTime && (
          <div className="time-entry-form">
            <Input
              type="number"
              min="0"
              step="0.25"
              placeholder="Horas"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              style={{ maxWidth: 90 }}
            />
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={{ maxWidth: 150 }} />
            <Input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }} />
            <Button variant="secondary" size="sm" onClick={handleLogTime} loading={logSubmitting} disabled={!hours}>
              + Registrar
            </Button>
          </div>
        )}
      </div>

      <div className="task-detail-section">
        <h3 className="mb-2" style={{ fontSize: 14 }}>
          Comentarios
        </h3>
        {commentsLoading ? (
          <LoadingState label="Cargando comentarios..." />
        ) : (comments ?? []).length === 0 ? (
          <EmptyState title="Sin comentarios" description="Se el primero en comentar esta tarea." />
        ) : (
          <div className="flex flex-col gap-3 mb-3">
            {(comments ?? []).map((c) => (
              <div key={c.id} className="comment-row">
                <div className="avatar">{(profileMap.get(c.user_id) ?? '?').slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div className="text-small" style={{ fontWeight: 500 }}>
                    {profileMap.get(c.user_id) ?? 'Usuario'}{' '}
                    <span className="text-muted" style={{ fontWeight: 400 }}>
                      · {new Date(c.created_at).toLocaleString('es-MX')}
                    </span>
                  </div>
                  <div className="text-body">{c.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder="Escribe un comentario..."
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            style={{ flex: 1, minHeight: 44 }}
          />
          <Button variant="secondary" onClick={handleAddComment} loading={commentSubmitting} disabled={!commentBody.trim()} icon={<Send size={14} />}>
            Enviar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
