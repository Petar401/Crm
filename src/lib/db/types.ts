/**
 * Hand-maintained types mirroring the Supabase schema (supabase/migrations).
 * Kept intentionally lightweight: Row types are precise; Insert/Update are
 * derived as partials so feature code stays ergonomic without a generated client.
 */

export type CompanyStatus = "lead" | "active" | "customer" | "inactive";
export type ContactRole = "decision_maker" | "influencer" | "admin" | "other";
export type DealStatus = "open" | "won" | "lost";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "task_created"
  | "task_completed"
  | "stage_changed"
  | "file_uploaded";
export type EntityType = "company" | "contact" | "deal" | "note";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string | null;
  role_id: string | null;
  is_full_access: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  workspace_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  status: CompanyStatus;
  owner_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  workspace_id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  contact_role: ContactRole;
  is_primary: boolean;
  owner_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealPipeline {
  id: string;
  workspace_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface DealStage {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string | null;
}

export interface Deal {
  id: string;
  workspace_id: string;
  company_id: string;
  primary_contact_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  name: string;
  value: number | null;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  status: DealStatus;
  owner_user_id: string | null;
  source: string | null;
  next_step: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  assigned_to: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  workspace_id: string;
  body: string;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteFolder {
  id: string;
  workspace_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotebookNote {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  workspace_id: string;
  type: ActivityType;
  title: string | null;
  detail: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  task_id: string | null;
  actor_user_id: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  workspace_id: string;
  entity_type: EntityType;
  entity_id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  workspace_id: string;
  name: string;
  is_default: boolean;
}

export interface MemberPermissionOverride {
  id: string;
  workspace_member_id: string;
  permission_key: string;
  allowed: boolean;
}
