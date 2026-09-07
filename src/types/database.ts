export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'COLLABORATOR';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type BillingType = 'HOURLY' | 'FIXED';
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type OccurrenceStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
  daily_available_hours: number | null;
  organization_id: string;
}

export interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  organization_id: string;
}

export interface Project {
  id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  repo_url: string | null;
  billing_type: BillingType;
  hourly_rate: number | null;
  organization_id: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  estimated_hours: number | null;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  project_id: string | null;
  action: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  hours: number;
  note: string | null;
  entry_date: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface RecurringTask {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  assignee_id: string | null;
  weekday: Weekday;
  time_of_day: string | null;
  estimated_hours: number | null;
  priority: TaskPriority;
  category: string | null;
  client_id: string | null;
  project_id: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTaskOccurrence {
  id: string;
  recurring_task_id: string;
  occurrence_date: string;
  status: OccurrenceStatus;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

// Minimal Database generic shape for supabase-js typing convenience.
export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> };
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client> };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> };
      project_members: {
        Row: ProjectMember;
        Insert: Partial<ProjectMember>;
        Update: Partial<ProjectMember>;
      };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> };
      activity_log: { Row: ActivityLog; Insert: Partial<ActivityLog>; Update: Partial<ActivityLog> };
      time_entries: { Row: TimeEntry; Insert: Partial<TimeEntry>; Update: Partial<TimeEntry> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      task_comments: { Row: TaskComment; Insert: Partial<TaskComment>; Update: Partial<TaskComment> };
      recurring_tasks: { Row: RecurringTask; Insert: Partial<RecurringTask>; Update: Partial<RecurringTask> };
      recurring_task_occurrences: {
        Row: RecurringTaskOccurrence;
        Insert: Partial<RecurringTaskOccurrence>;
        Update: Partial<RecurringTaskOccurrence>;
      };
    };
  };
}
