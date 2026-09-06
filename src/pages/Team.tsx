import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import {
  fetchProfiles,
  fetchProjectMembersForProjects,
  fetchProjects,
  fetchTasks,
  fetchTimeEntries,
  updateProfileCapacity,
  updateProfileRole,
} from '../lib/queries';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Table, type Column } from '../components/Table';
import { Badge, roleColor } from '../components/Badge';
import type { Profile, Role } from '../types/database';

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

export function Team() {
  const { isAdmin, canManage, profile } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [capacityDrafts, setCapacityDrafts] = useState<Record<string, string>>({});
  const [capacityPendingId, setCapacityPendingId] = useState<string | null>(null);

  const { data: profiles, loading, error, refetch } = useSupabaseQuery(() => fetchProfiles());
  const { data: projects } = useSupabaseQuery(() => fetchProjects());
  const { data: tasks } = useSupabaseQuery(() => fetchTasks());
  const { data: timeEntries } = useSupabaseQuery(() => fetchTimeEntries());

  // For admin, fetch all project_members across all visible projects to compute counts.
  const projectIds = useMemo(() => (projects ?? []).map((p) => p.id), [projects]);
  const { data: allMembers } = useSupabaseQuery(
    () => fetchProjectMembersForProjects(projectIds),
    [projectIds.join(',')]
  );

  const activeCountByUser = useMemo(() => {
    const activeProjectIds = new Set((projects ?? []).filter((p) => p.status === 'ACTIVE').map((p) => p.id));
    const map = new Map<string, number>();
    (allMembers ?? []).forEach((m) => {
      if (activeProjectIds.has(m.project_id)) {
        map.set(m.user_id, (map.get(m.user_id) ?? 0) + 1);
      }
    });
    return map;
  }, [allMembers, projects]);

  // Workload: open tasks (TODO + IN_PROGRESS) and hours logged this week, per user.
  // ADMIN/PROJECT_MANAGER see everyone's (part of "view metrics/reports");
  // COLLABORATOR only sees their own row's numbers (others show as blank),
  // matching the spec's role-scoping for this view.
  const openTasksByUser = useMemo(() => {
    const map = new Map<string, number>();
    (tasks ?? []).forEach((t) => {
      if (t.assigned_to && (t.status === 'TODO' || t.status === 'IN_PROGRESS')) {
        map.set(t.assigned_to, (map.get(t.assigned_to) ?? 0) + 1);
      }
    });
    return map;
  }, [tasks]);

  const hoursThisWeekByUser = useMemo(() => {
    const weekStart = startOfWeek();
    const map = new Map<string, number>();
    (timeEntries ?? []).forEach((e) => {
      if (new Date(e.entry_date) >= weekStart) {
        map.set(e.user_id, (map.get(e.user_id) ?? 0) + Number(e.hours));
      }
    });
    return map;
  }, [timeEntries]);

  function canSeeWorkload(userId: string) {
    return canManage || userId === profile?.id;
  }

  async function handleRoleChange(userId: string, role: Role) {
    setPendingId(userId);
    await updateProfileRole(userId, role);
    setPendingId(null);
    refetch();
  }

  async function handleCapacityCommit(userId: string, currentValue: number | null) {
    const draft = capacityDrafts[userId];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (currentValue == null) return;
      setCapacityPendingId(userId);
      await updateProfileCapacity(userId, null);
      setCapacityPendingId(null);
      refetch();
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) {
      // Invalid: revert to the last known good value without saving.
      setCapacityDrafts((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }
    if (parsed === currentValue) return;
    setCapacityPendingId(userId);
    await updateProfileCapacity(userId, parsed);
    setCapacityPendingId(null);
    refetch();
  }

  const columns: Column<Profile>[] = [
    {
      header: 'Nombre',
      key: 'name',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="avatar">{p.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 500 }}>{p.name}</div>
            <div className="text-small text-muted">{p.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Rol',
      key: 'role',
      render: (p) =>
        isAdmin ? (
          <select
            className="select-inline"
            value={p.role}
            disabled={pendingId === p.id}
            onChange={(e) => handleRoleChange(p.id, e.target.value as Role)}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
            <option value="COLLABORATOR">COLLABORATOR</option>
          </select>
        ) : (
          <Badge color={roleColor(p.role)}>{p.role}</Badge>
        ),
    },
    { header: 'Proyectos activos', key: 'active', render: (p) => activeCountByUser.get(p.id) ?? 0 },
    {
      header: 'Disponibilidad diaria',
      key: 'capacity',
      render: (p) =>
        isAdmin ? (
          <input
            className="input"
            type="number"
            min="0.01"
            max="24"
            step="0.5"
            style={{ width: 80 }}
            disabled={capacityPendingId === p.id}
            value={capacityDrafts[p.id] ?? (p.daily_available_hours != null ? String(p.daily_available_hours) : '')}
            onChange={(e) => setCapacityDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
            onBlur={() => handleCapacityCommit(p.id, p.daily_available_hours)}
            placeholder="—"
            title="Horas disponibles por día laboral (lunes a sábado). Los domingos no cuentan como día laboral."
          />
        ) : (
          <span>{p.daily_available_hours != null ? `${p.daily_available_hours} h/día` : '—'}</span>
        ),
    },
    {
      header: 'Tareas abiertas',
      key: 'openTasks',
      render: (p) => (canSeeWorkload(p.id) ? openTasksByUser.get(p.id) ?? 0 : <span className="workload-muted">—</span>),
    },
    {
      header: 'Horas esta semana',
      key: 'hoursWeek',
      render: (p) =>
        canSeeWorkload(p.id) ? (
          `${hoursThisWeekByUser.get(p.id) ?? 0}h`
        ) : (
          <span className="workload-muted">—</span>
        ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Equipo</h1>
          <p className="text-secondary mt-1">
            {isAdmin ? 'Administra los roles del equipo.' : 'Miembros del equipo de Miselium.'}
          </p>
          <p className="text-small text-muted mt-1">
            La disponibilidad es diaria, de lunes a sábado — los domingos no cuentan como día laboral.
          </p>
        </div>
      </div>

      {loading && <LoadingState label="Cargando equipo..." />}
      {!loading && error && <ErrorState description={error} onRetry={refetch} />}
      {!loading && !error && profiles && profiles.length === 0 && <EmptyState title="Sin integrantes" />}
      {!loading && !error && profiles && profiles.length > 0 && (
        <Table columns={columns} rows={profiles} rowKey={(p) => p.id} />
      )}
    </div>
  );
}
