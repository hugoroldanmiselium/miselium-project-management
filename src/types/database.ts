export type Role = 'ADMIN' | 'DEVELOPER';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type BillingType = 'HOURLY' | 'FIXED';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
  daily_available_hours: number | null;
}

export interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
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

// Minimal Database generic shape for supabase-js typing convenience.
export interface Database {
  public: {
    Tables: {
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
    };
  };
}
