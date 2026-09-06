export type Role = 'ADMIN' | 'DEVELOPER';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
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
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  project_id: string | null;
  action: string;
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
    };
  };
}
