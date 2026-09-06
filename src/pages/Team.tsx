import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchProfiles, fetchProjectMembersForProjects, fetchProjects, updateProfileRole } from '../lib/queries';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Table, type Column } from '../components/Table';
import { Badge } from '../components/Badge';
import type { Profile } from '../types/database';

export function Team() {
  const { isAdmin } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: profiles, loading, error, refetch } = useSupabaseQuery(() => fetchProfiles());
  const { data: projects } = useSupabaseQuery(() => fetchProjects());

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

  async function handleRoleChange(userId: string, role: 'ADMIN' | 'DEVELOPER') {
    setPendingId(userId);
    await updateProfileRole(userId, role);
    setPendingId(null);
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
            onChange={(e) => handleRoleChange(p.id, e.target.value as 'ADMIN' | 'DEVELOPER')}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="DEVELOPER">DEVELOPER</option>
          </select>
        ) : (
          <Badge color={p.role === 'ADMIN' ? 'purple' : 'blue'}>{p.role}</Badge>
        ),
    },
    { header: 'Proyectos activos', key: 'active', render: (p) => activeCountByUser.get(p.id) ?? 0 },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Equipo</h1>
          <p className="text-secondary mt-1">
            {isAdmin ? 'Administra los roles del equipo.' : 'Miembros del equipo de Miselium.'}
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
