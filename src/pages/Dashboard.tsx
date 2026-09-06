import { useMemo } from 'react';
import { FolderKanban, ListTodo, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchProfiles, fetchProjects, fetchRecentActivity, fetchTasks } from '../lib/queries';
import { StatCard } from '../components/StatCard';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { HorizontalBarChart, DonutChart } from '../components/Chart';
import { TaskItem } from '../components/TaskItem';
import { computeProgress } from '../components/ProjectProgress';
import { isOverdue } from '../components/Badge';

export function Dashboard() {
  const { profile, isAdmin } = useAuth();

  const { data: projects, loading: loadingProjects, error: errorProjects, refetch: refetchProjects } = useSupabaseQuery(
    () => fetchProjects()
  );
  const { data: tasks, loading: loadingTasks, error: errorTasks, refetch: refetchTasks } = useSupabaseQuery(() =>
    fetchTasks()
  );
  const { data: activity, loading: loadingActivity } = useSupabaseQuery(() => fetchRecentActivity(8));
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());

  const loading = loadingProjects || loadingTasks;
  const error = errorProjects || errorTasks;

  // RLS already scopes projects/tasks to the current user when DEVELOPER, so
  // no extra client-side filtering is required for correctness — but we keep
  // scoping explicit here for clarity when computing "my" metrics.
  const scopedTasks = useMemo(() => {
    if (!tasks) return [];
    if (isAdmin) return tasks;
    return tasks.filter((t) => t.assigned_to === profile?.id);
  }, [tasks, isAdmin, profile]);

  const scopedProjects = useMemo(() => projects ?? [], [projects]);

  const activeProjects = scopedProjects.filter((p) => p.status === 'ACTIVE').length;
  const pendingTasks = scopedTasks.filter((t) => t.status !== 'DONE').length;
  const overdueTasks = scopedTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const completedTasks = scopedTasks.filter((t) => t.status === 'DONE').length;
  const deliveryRate = scopedTasks.length > 0 ? Math.round((completedTasks / scopedTasks.length) * 100) : 0;

  const projectProgressData = useMemo(() => {
    return scopedProjects
      .filter((p) => p.status !== 'COMPLETED')
      .slice(0, 6)
      .map((p) => {
        const projectTasks = (tasks ?? []).filter((t) => t.project_id === p.id);
        return { label: p.name, value: computeProgress(projectTasks) };
      });
  }, [scopedProjects, tasks]);

  const taskDistribution = useMemo(() => {
    return [
      { label: 'Pendiente', value: scopedTasks.filter((t) => t.status === 'TODO').length, color: 'var(--color-blue)' },
      { label: 'En progreso', value: scopedTasks.filter((t) => t.status === 'IN_PROGRESS').length, color: 'var(--color-yellow)' },
      { label: 'Completada', value: scopedTasks.filter((t) => t.status === 'DONE').length, color: 'var(--color-green)' },
    ];
  }, [scopedTasks]);

  const projectMap = useMemo(() => new Map(scopedProjects.map((p) => [p.id, p.name])), [scopedProjects]);
  const profileMap = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p.name])), [profiles]);

  const todayTasks = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return scopedTasks.filter((t) => t.due_date === todayStr).slice(0, 6);
  }, [scopedTasks]);

  const greetingName = profile?.name?.split(' ')[0] ?? '';
  const dateSub = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) return <LoadingState label="Cargando dashboard..." />;
  if (error) return <ErrorState description={error} onRetry={() => { refetchProjects(); refetchTasks(); }} />;

  return (
    <div>
      <div className="mb-6">
        <h1>Buenos dias, {greetingName}</h1>
        <p className="text-secondary mt-1" style={{ textTransform: 'capitalize' }}>
          {dateSub}
        </p>
      </div>

      <div className="stat-grid mb-6">
        <StatCard label="Proyectos activos" value={activeProjects} icon={<FolderKanban size={14} />} delta={`de ${scopedProjects.length} totales`} />
        <StatCard label="Tareas pendientes" value={pendingTasks} icon={<ListTodo size={14} />} delta="por completar" />
        <StatCard label="Tareas vencidas" value={overdueTasks} icon={<AlertTriangle size={14} />} delta="requieren atencion" />
        <StatCard label="% de entrega" value={`${deliveryRate}%`} icon={<CheckCircle2 size={14} />} delta={`${completedTasks} completadas`} />
      </div>

      <div className="two-col mb-6">
        <div className="card card-padded">
          <h3 className="mb-4">Progreso por proyecto</h3>
          {projectProgressData.length === 0 ? (
            <EmptyState title="Sin proyectos activos" />
          ) : (
            <HorizontalBarChart data={projectProgressData} max={100} />
          )}
        </div>
        <div className="card card-padded">
          <h3 className="mb-4">Distribucion de tareas</h3>
          {scopedTasks.length === 0 ? <EmptyState title="Sin tareas" /> : <DonutChart data={taskDistribution} />}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 15 }}>Actividad reciente</h3>
          </div>
          {loadingActivity ? (
            <LoadingState />
          ) : (activity ?? []).length === 0 ? (
            <EmptyState title="Sin actividad reciente" />
          ) : (
            (activity ?? []).map((a) => (
              <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                <div className="text-body">{a.action}</div>
                <div className="text-small text-muted mt-1">
                  {profileMap.get(a.user_id ?? '') ?? 'Usuario'} · {projectMap.get(a.project_id ?? '') ?? ''} ·{' '}
                  {new Date(a.created_at).toLocaleDateString('es-MX')}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 15 }}>Tareas de hoy</h3>
          </div>
          {todayTasks.length === 0 ? (
            <EmptyState title="Sin tareas para hoy" />
          ) : (
            todayTasks.map((t) => (
              <TaskItem key={t.id} task={t} projectName={projectMap.get(t.project_id)} showProject />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
