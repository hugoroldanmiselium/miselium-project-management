export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'COLLABORATOR';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type BillingType = 'HOURLY' | 'FIXED';
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type OccurrenceStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
export type FinanceCategoryType = 'INCOME' | 'EXPENSE';
export type IncomeStatus = 'COBRADO' | 'PENDIENTE';
export type ExpenseStatus = 'PAGADO' | 'PENDIENTE';
export type TaxProvisionStatus = 'PENDIENTE' | 'PAGADO';

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
  finance_access: boolean;
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

export interface FinanceCategory {
  id: string;
  organization_id: string;
  type: FinanceCategoryType;
  name: string;
  created_at: string;
}

export interface Income {
  id: string;
  organization_id: string;
  date: string;
  concept: string;
  client_id: string | null;
  category_id: string | null;
  subtotal: number;
  iva: number;
  total: number;
  payment_method: string | null;
  status: IncomeStatus;
  due_date: string | null;
  collected_date: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  organization_id: string;
  date: string;
  concept: string;
  vendor: string | null;
  category_id: string | null;
  subtotal: number;
  iva: number;
  total: number;
  payment_method: string | null;
  status: ExpenseStatus;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: string | null;
  potential_value: number | null;
  last_contact_date: string | null;
  next_followup_at: string | null;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactInteraction {
  id: string;
  contact_id: string;
  note: string;
  user_id: string;
  created_at: string;
}

export interface TaxProvision {
  id: string;
  organization_id: string;
  date: string;
  tax_type: string;
  period: string;
  base: number | null;
  iva_trasladado: number | null;
  iva_acreditable: number | null;
  iva_por_pagar: number | null;
  isr_estimado: number | null;
  total_provisioned: number;
  total_paid: number | null;
  status: TaxProvisionStatus;
  notes: string | null;
  created_by: string;
  updated_by: string | null;
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
      finance_categories: { Row: FinanceCategory; Insert: Partial<FinanceCategory>; Update: Partial<FinanceCategory> };
      incomes: { Row: Income; Insert: Partial<Income>; Update: Partial<Income> };
      expenses: { Row: Expense; Insert: Partial<Expense>; Update: Partial<Expense> };
      tax_provisions: { Row: TaxProvision; Insert: Partial<TaxProvision>; Update: Partial<TaxProvision> };
      contacts: { Row: Contact; Insert: Partial<Contact>; Update: Partial<Contact> };
      contact_interactions: { Row: ContactInteraction; Insert: Partial<ContactInteraction>; Update: Partial<ContactInteraction> };
    };
  };
}
