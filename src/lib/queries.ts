import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  ActivityLog,
  Client,
  Notification,
  Profile,
  Project,
  ProjectMember,
  ProjectStatus,
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  TimeEntry,
} from '../types/database';

type Result<T> = Promise<{ data: T | null; error: PostgrestError | null }>;

// ===== Profiles =====
export const fetchProfiles = async (): Result<Profile[]> => {
  const { data, error } = await supabase.from('profiles').select('*').order('name', { ascending: true });
  return { data: data as Profile[] | null, error };
};

export const updateProfileRole = async (id: string, role: 'ADMIN' | 'DEVELOPER'): Result<Profile> => {
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select().single();
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
