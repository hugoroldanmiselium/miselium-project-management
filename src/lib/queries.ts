import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  ActivityLog,
  Client,
  Expense,
  FinanceCategory,
  FinanceCategoryType,
  Income,
  Notification,
  OccurrenceStatus,
  Profile,
  Project,
  ProjectMember,
  ProjectStatus,
  RecurringTask,
  RecurringTaskOccurrence,
  Role,
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  TaxProvision,
  TimeEntry,
} from '../types/database';

type Result<T> = Promise<{ data: T | null; error: PostgrestError | null }>;

// ===== Profiles =====
export const fetchProfiles = async (): Result<Profile[]> => {
  const { data, error } = await supabase.from('profiles').select('*').order('name', { ascending: true });
  return { data: data as Profile[] | null, error };
};

export const updateProfileRole = async (id: string, role: Role): Result<Profile> => {
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select().single();
  return { data: data as Profile | null, error };
};

export const updateProfileCapacity = async (id: string, daily_available_hours: number | null): Result<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ daily_available_hours })
    .eq('id', id)
    .select()
    .single();
  return { data: data as Profile | null, error };
};

export const updateProfileFinanceAccess = async (id: string, finance_access: boolean): Result<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ finance_access })
    .eq('id', id)
    .select()
    .single();
  return { data: data as Profile | null, error };
};

// ===== Clients =====
export const fetchClients = async (): Result<Client[]> => {
  const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
  return { data: data as Client[] | null, error };
};

export const fetchClient = async (id: string): Result<Client> => {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
  return { data: data as Client | null, error };
};

export const createClient = async (input: Partial<Client>): Result<Client> => {
  const { data, error } = await supabase.from('clients').insert(input).select().single();
  return { data: data as Client | null, error };
};

export const updateClient = async (id: string, input: Partial<Client>): Result<Client> => {
  const { data, error } = await supabase.from('clients').update(input).eq('id', id).select().single();
  return { data: data as Client | null, error };
};

export const deleteClient = (id: string) => supabase.from('clients').delete().eq('id', id);

// ===== Projects =====
export const fetchProjects = async (): Result<Project[]> => {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  return { data: data as Project[] | null, error };
};

export const fetchProject = async (id: string): Result<Project> => {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
  return { data: data as Project | null, error };
};

export const createProject = async (input: Partial<Project>): Result<Project> => {
  const { data, error } = await supabase.from('projects').insert(input).select().single();
  return { data: data as Project | null, error };
};

export const updateProject = async (id: string, input: Partial<Project>): Result<Project> => {
  const { data, error } = await supabase.from('projects').update(input).eq('id', id).select().single();
  return { data: data as Project | null, error };
};

export const deleteProject = (id: string) => supabase.from('projects').delete().eq('id', id);

export const updateProjectStatus = async (id: string, status: ProjectStatus): Result<Project> => {
  const { data, error } = await supabase.from('projects').update({ status }).eq('id', id).select().single();
  return { data: data as Project | null, error };
};

// ===== Project members =====
export const fetchProjectMembers = async (projectId: string): Result<ProjectMember[]> => {
  const { data, error } = await supabase.from('project_members').select('*').eq('project_id', projectId);
  return { data: data as ProjectMember[] | null, error };
};

export const fetchProjectMembersForProjects = async (projectIds: string[]): Result<ProjectMember[]> => {
  if (projectIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.from('project_members').select('*').in('project_id', projectIds);
  return { data: data as ProjectMember[] | null, error };
};

export const addProjectMember = (projectId: string, userId: string) =>
  supabase.from('project_members').insert({ project_id: projectId, user_id: userId });

export const removeProjectMember = (projectId: string, userId: string) =>
  supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);

// ===== Tasks =====
export const fetchTasks = async (): Result<Task[]> => {
  const { data, error } = await supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
  return { data: data as Task[] | null, error };
};

export const fetchTasksForProject = async (projectId: string): Result<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  return { data: data as Task[] | null, error };
};

export const fetchTasksForUser = async (userId: string): Result<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .order('due_date', { ascending: true, nullsFirst: false });
  return { data: data as Task[] | null, error };
};

export const createTask = async (input: Partial<Task>): Result<Task> => {
  const { data, error } = await supabase.from('tasks').insert(input).select().single();
  return { data: data as Task | null, error };
};

export const updateTask = async (id: string, input: Partial<Task>): Result<Task> => {
  const { data, error } = await supabase.from('tasks').update(input).eq('id', id).select().single();
  return { data: data as Task | null, error };
};

export const deleteTask = (id: string) => supabase.from('tasks').delete().eq('id', id);

export const updateTaskStatus = async (id: string, status: TaskStatus): Result<Task> => {
  const { data, error } = await supabase.from('tasks').update({ status }).eq('id', id).select().single();
  return { data: data as Task | null, error };
};

export type { TaskPriority };

// ===== Activity log =====
export const fetchActivityForProject = async (projectId: string): Result<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);
  return { data: data as ActivityLog[] | null, error };
};

export const fetchRecentActivity = async (limit = 8): Result<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data as ActivityLog[] | null, error };
};

export const logActivity = (userId: string, projectId: string, action: string) =>
  supabase.from('activity_log').insert({ user_id: userId, project_id: projectId, action });

// ===== Time entries =====
export const fetchTimeEntries = async (): Result<TimeEntry[]> => {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .order('entry_date', { ascending: false });
  return { data: data as TimeEntry[] | null, error };
};

export const fetchTimeEntriesForTask = async (taskId: string): Result<TimeEntry[]> => {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('task_id', taskId)
    .order('entry_date', { ascending: false });
  return { data: data as TimeEntry[] | null, error };
};

export const fetchTimeEntriesForTasks = async (taskIds: string[]): Result<TimeEntry[]> => {
  if (taskIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.from('time_entries').select('*').in('task_id', taskIds);
  return { data: data as TimeEntry[] | null, error };
};

export const fetchTimeEntriesForUser = async (userId: string): Result<TimeEntry[]> => {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false });
  return { data: data as TimeEntry[] | null, error };
};

export const createTimeEntry = async (input: {
  task_id: string;
  user_id: string;
  hours: number;
  note: string | null;
  entry_date: string;
}): Result<TimeEntry> => {
  const { data, error } = await supabase.from('time_entries').insert(input).select().single();
  return { data: data as TimeEntry | null, error };
};

export const deleteTimeEntry = (id: string) => supabase.from('time_entries').delete().eq('id', id);

// ===== Notifications =====
export const fetchNotifications = async (userId: string): Result<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  return { data: data as Notification[] | null, error };
};

export const markNotificationRead = (id: string) =>
  supabase.from('notifications').update({ read: true }).eq('id', id);

export const markAllNotificationsRead = (userId: string) =>
  supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);

// ===== Task comments =====
export const fetchCommentsForTask = async (taskId: string): Result<TaskComment[]> => {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  return { data: data as TaskComment[] | null, error };
};

export const createComment = async (input: { task_id: string; user_id: string; body: string }): Result<TaskComment> => {
  const { data, error } = await supabase.from('task_comments').insert(input).select().single();
  return { data: data as TaskComment | null, error };
};

// ===== Recurring tasks =====
export const fetchRecurringTasks = async (): Result<RecurringTask[]> => {
  const { data, error } = await supabase.from('recurring_tasks').select('*').order('name', { ascending: true });
  return { data: data as RecurringTask[] | null, error };
};

export const createRecurringTask = async (input: Partial<RecurringTask>): Result<RecurringTask> => {
  const { data, error } = await supabase.from('recurring_tasks').insert(input).select().single();
  return { data: data as RecurringTask | null, error };
};

export const updateRecurringTask = async (id: string, input: Partial<RecurringTask>): Result<RecurringTask> => {
  const { data, error } = await supabase.from('recurring_tasks').update(input).eq('id', id).select().single();
  return { data: data as RecurringTask | null, error };
};

export const deleteRecurringTask = (id: string) => supabase.from('recurring_tasks').delete().eq('id', id);

// ===== Recurring task occurrences =====
// Pending occurrences are never pre-generated - see 010_recurring_tasks.sql.
// Fetch only the persisted rows (status overrides) for a set of recurring
// task ids within a date range; the frontend overlays these onto the
// computed "virtual" PENDING occurrences (src/lib/recurringDates.ts).
export const fetchOccurrencesInRange = async (
  recurringTaskIds: string[],
  fromDate: string,
  toDate: string
): Result<RecurringTaskOccurrence[]> => {
  if (recurringTaskIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('recurring_task_occurrences')
    .select('*')
    .in('recurring_task_id', recurringTaskIds)
    .gte('occurrence_date', fromDate)
    .lte('occurrence_date', toDate);
  return { data: data as RecurringTaskOccurrence[] | null, error };
};

export const fetchOccurrenceHistory = async (recurringTaskId: string): Result<RecurringTaskOccurrence[]> => {
  const { data, error } = await supabase
    .from('recurring_task_occurrences')
    .select('*')
    .eq('recurring_task_id', recurringTaskId)
    .order('occurrence_date', { ascending: false });
  return { data: data as RecurringTaskOccurrence[] | null, error };
};

// Upsert on (recurring_task_id, occurrence_date) - the only way an
// occurrence's status is ever changed. Safe to call repeatedly for the same
// date (e.g. revisiting the same week) since the DB has a unique constraint
// on that pair; never creates a duplicate row.
export const setOccurrenceStatus = async (input: {
  recurring_task_id: string;
  occurrence_date: string;
  status: OccurrenceStatus;
  completed_at: string | null;
  completed_by: string | null;
}): Result<RecurringTaskOccurrence> => {
  const { data, error } = await supabase
    .from('recurring_task_occurrences')
    .upsert(input, { onConflict: 'recurring_task_id,occurrence_date' })
    .select()
    .single();
  return { data: data as RecurringTaskOccurrence | null, error };
};

// ===== Finance: categories =====
export const fetchFinanceCategories = async (): Result<FinanceCategory[]> => {
  const { data, error } = await supabase.from('finance_categories').select('*').order('name', { ascending: true });
  return { data: data as FinanceCategory[] | null, error };
};

export const createFinanceCategory = async (input: {
  organization_id: string;
  type: FinanceCategoryType;
  name: string;
}): Result<FinanceCategory> => {
  const { data, error } = await supabase.from('finance_categories').insert(input).select().single();
  return { data: data as FinanceCategory | null, error };
};

// ===== Finance: incomes =====
export const fetchIncomes = async (): Result<Income[]> => {
  const { data, error } = await supabase.from('incomes').select('*').order('date', { ascending: false });
  return { data: data as Income[] | null, error };
};

export const createIncome = async (input: Partial<Income>): Result<Income> => {
  const { data, error } = await supabase.from('incomes').insert(input).select().single();
  return { data: data as Income | null, error };
};

export const updateIncome = async (id: string, input: Partial<Income>): Result<Income> => {
  const { data, error } = await supabase.from('incomes').update(input).eq('id', id).select().single();
  return { data: data as Income | null, error };
};

export const deleteIncome = (id: string) => supabase.from('incomes').delete().eq('id', id);

// ===== Finance: expenses =====
export const fetchExpenses = async (): Result<Expense[]> => {
  const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
  return { data: data as Expense[] | null, error };
};

export const createExpense = async (input: Partial<Expense>): Result<Expense> => {
  const { data, error } = await supabase.from('expenses').insert(input).select().single();
  return { data: data as Expense | null, error };
};

export const updateExpense = async (id: string, input: Partial<Expense>): Result<Expense> => {
  const { data, error } = await supabase.from('expenses').update(input).eq('id', id).select().single();
  return { data: data as Expense | null, error };
};

export const deleteExpense = (id: string) => supabase.from('expenses').delete().eq('id', id);

// ===== Finance: tax provisions =====
export const fetchTaxProvisions = async (): Result<TaxProvision[]> => {
  const { data, error } = await supabase.from('tax_provisions').select('*').order('date', { ascending: false });
  return { data: data as TaxProvision[] | null, error };
};

export const createTaxProvision = async (input: Partial<TaxProvision>): Result<TaxProvision> => {
  const { data, error } = await supabase.from('tax_provisions').insert(input).select().single();
  return { data: data as TaxProvision | null, error };
};

export const updateTaxProvision = async (id: string, input: Partial<TaxProvision>): Result<TaxProvision> => {
  const { data, error } = await supabase.from('tax_provisions').update(input).eq('id', id).select().single();
  return { data: data as TaxProvision | null, error };
};

export const deleteTaxProvision = (id: string) => supabase.from('tax_provisions').delete().eq('id', id);
