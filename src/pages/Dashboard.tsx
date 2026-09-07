import { useMemo } from 'react';
import { FolderKanban, ListTodo, AlertTriangle, CheckCircle2, Hourglass, Gauge } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchOccurrencesInRange, fetchProfiles, fetchProjects, fetchRecentActivity, fetchRecurringTasks, fetchTasks } from '../lib/queries';
import { StatCard } from '../components/StatCard';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { HorizontalBarChart, DonutChart } from '../components/Chart';
import { TaskItem } from '../components/TaskItem';
import { computeProgress } from '../components/ProjectProgress';
import { isOverdue } from '../components/Badge';
import { addDays, startOfWeek, todayDateStr } from '../lib/recurringDates';
import { buildWeekOccurrences } from '../lib/occurrences';

export function Dashboard() {
  const { profile, canManage } = useAuth();

  const { data: projects, loading: loadingProjects, error: errorProjects, refetch: refetchProjects } = useSupabaseQuery(
    () => fetchProjects()
  );
  const { data: tasks, loading: loadingTasks, error: errorTasks, refetch: refetchTasks } = useSupabaseQuery(() =>
    fetchTasks()
  );
  const { data: activity, loading: loadingActivity } = useSupabaseQuery(() => fetchRecentActivity(8));
  const { data: profiles } = useSupabaseQuery(() => fetchProfiles());

  // Recurring tasks' estimated hours participate in the same "horas
  // pendientes" / "capacidad diaria" aggregates below, extending the
  // existing minimal capacity display rather than building a new one - see
  // 010_recurring_tasks.sql / RecurringTasksPanel for the full feature.
  const { data: recurringTasks } = useSupabaseQuery(() => fetchRecurringTasks());
  const todayStr = todayDateStr();
  const weekStart = useMemo(() => startOfWeek(todayStr), [todayStr]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const recurringTaskIds = useMemo(() => (recurringTasks ?? []).map((r) => r.id), [recurringTasks]);
  const { data: weekOccurrenceRows } = useSupabaseQuery(
    () => fetchOccurrencesInRange(recurringTaskIds, weekStart, weekEnd),
    [recurringTaskIds.join(','), weekStart]
  );

  const scopedRecurringTasks = useMemo(() => {
    const list = recurringTasks ?? [];
    return canManage ? list : list.filter((rt) => rt.assignee_id === profile?.id);
  }, [recurringTasks, canManage, profile]);

  const recurringWeekViews = useMemo(
    () => buildWeekOccurrences(scopedRecurringTasks, weekOccurrenceRows ?? [], weekStart),
    [scopedRecurringTasks, weekOccurrenceRows, weekStart]
  );

  // Sum of estimated_hours for this week's recurring occurrences that are
  // still open (not DONE/SKIPPED) - the recurring analog of pendingHours
  // below, which sums project tasks with status !== 'DONE'.
  const pendingRecurringHours = useMemo(
    () =>
      recurringWeekViews
        .filter((v) => v.status !== 'DONE' && v.status !== 'SKIPPED')
        .reduce((sum, v) => sum + Number(v.recurringTask.estimated_hours ?? 0), 0),
    [recurringWeekViews]
  );

  const loading = loadingProjects || loadingTasks;
  const error = errorProjects || errorTasks;

  // RLS already scopes projects/tasks to the current user when COLLABORATOR,
  // so no extra client-side filtering is required for correctness — but we
  // keep scoping explicit here for clarity when computing "my" metrics.
  const scopedTasks = useMemo(() => {
    if (!tasks) return [];
    if (canManage) return tasks;
    return tasks.filter((t) => t.assigned_to === profile?.id);
  }, [tasks, canManage, profile]);

  const scopedProjects = useMemo(() => projects ?? [], [projects]);

  const activeProjects = scopedProjects.filter((p) => p.status === 'ACTIVE').length;
  const pendingTasks = scopedTasks.filter((t) => t.status !== 'DONE').length;
  const overdueTasks = scopedTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const completedTasks = scopedTasks.filter((t) => t.status === 'DONE').length;
  const deliveryRate = scopedTasks.length > 0 ? Math.round((completedTasks / scopedTasks.length) * 100) : 0;

  // Pure aggregate displays, not a scheduling/workload algorithm: pending
  // estimated hours over the same role-scoped task set already used for the
  // other KPIs above (null treated as 0, never crashes on missing estimates),
  // plus this week's still-open recurring occurrences (pendingRecurringHours,
  // computed above) so recurring work counts toward the same total.
  const pendingProjectHours = scopedTasks
    .filter((t) => t.status !== 'DONE')
    .reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0);
  const pendingHours = pendingProjectHours + pendingRecurringHours;

  // Daily capacity: ADMIN/PROJECT_MANAGER see the whole team's summed daily
  // capacity (matching how every other team-wide stat here is scoped); a
  // COLLABORATOR sees just their own daily capacity, matching the Team
  // page's per-user workload scoping (canSeeWorkload) rather than exposing
  // teammates' data.
  const dailyCapacity = canManage
    ? (profiles ?? []).reduce((sum, p) => sum + Number(p.daily_available_hours ?? 0), 0)
    : Number(profile?.daily_available_hours ?? 0);

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
        <StatCard label="Proyectos activos" value={activeProjects} icon={<FolderKanban size={14} />} delta={`de ${scopedProjects.length} totales`} accent="blue" />
        <StatCard label="Tareas pendientes" value={pendingTasks} icon={<ListTodo size={14} />} delta="por completar" />
        <StatCard label="Tareas vencidas" value={overdueTasks} icon={<AlertTriangle size={14} />} delta="requieren atencion" accent={overdueTasks > 0 ? 'red' : 'green'} />
        <StatCard label="% de entrega" value={`${deliveryRate}%`} icon={<CheckCircle2 size={14} />} delta={`${completedTasks} completadas`} accent="green" />
        <StatCard label="Horas pendientes" value={`${pendingHours}h`} icon={<Hourglass size={14} />} delta="estimadas, sin completar" accent="amber" />
        <StatCard
          label="Capacidad diaria"
          value={`${dailyCapacity}h`}
          icon={<Gauge size={14} />}
          delta={canManage ? 'equipo completo' : 'tu disponibilidad'}
        />
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
