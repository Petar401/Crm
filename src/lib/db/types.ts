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
export type EntityType =
  | "company"
  | "contact"
  | "deal"
  | "note"
  | "workspace"
  | "lead";

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
  industry: string | null;
  timezone: string;
  currency: string;
  locale: string;
  logo_url: string | null;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role_id: string | null;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface WorkspaceOnboarding {
  workspace_id: string;
  completed_steps: number[];
  template_key: string | null;
  completed_at: string | null;
  updated_at: string;
}

export type NotificationKind =
  | "task_assigned"
  | "task_due_soon"
  | "deal_stage_changed"
  | "deal_won"
  | "mention"
  | "lead_scored"
  | "campaign_finished"
  | "email_received"
  | "workspace_invited"
  | "member_joined";

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  actor_user_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  user_id: string;
  workspace_id: string;
  kind: NotificationKind;
  in_app: boolean;
  email: boolean;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  user_agent: string | null;
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
  lead_id: string | null;
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
  lead_id: string | null;
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
  folder_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceDocType = "invoice" | "receipt" | "other";

export interface InvoiceFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  doc_type: InvoiceDocType;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  invoice_date: string | null;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignFrequency = "manual" | "daily" | "weekly";
export type CampaignSource = "openstreetmap" | "apollo";
export type LeadStatus = "pending" | "approved" | "rejected" | "converted";

export interface LeadCampaign {
  id: string;
  workspace_id: string;
  name: string;
  source: CampaignSource;
  business_description: string;
  target_categories: string[];
  location: string | null;
  country: string | null;
  frequency: CampaignFrequency;
  auto_create: boolean;
  max_results: number;
  run_hour: number;
  min_score: number;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  company_name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  state: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  job_title: string | null;
  source: string;
  source_ref: string | null;
  match_score: number | null;
  match_reason: string | null;
  status: LeadStatus;
  converted_company_id: string | null;
  converted_contact_id: string | null;
  raw: unknown;
  owner_user_id: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  enriched_at: string | null;
  enriched_by: string | null;
  created_at: string;
  updated_at: string;
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

export type AiProvider = "groq" | "openrouter";

export interface WorkspaceAiSettings {
  workspace_id: string;
  encrypted_api_key: string;
  key_preview: string;
  provider: AiProvider;
  model: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface WorkspaceApolloSettings {
  workspace_id: string;
  encrypted_api_key: string;
  key_preview: string;
  updated_by: string | null;
  updated_at: string;
}

export type EmailAuthType = "basic" | "oauth";

/**
 * Per-workspace shared mailbox connection (see 0025_email.sql). The mailbox
 * password lives in `encrypted_password` (AES-GCM via lib/security/secret-box);
 * never select it into anything that reaches the client. `oauth_provider` /
 * `encrypted_oauth_tokens` are reserved for the phase-2 OAuth flow.
 */
export interface WorkspaceEmailSettings {
  workspace_id: string;
  from_name: string | null;
  from_email: string;
  auth_type: EmailAuthType;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean;
  encrypted_password: string | null;
  oauth_provider: string | null;
  encrypted_oauth_tokens: string | null;
  email_preview: string;
  last_verified_at: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type EmailDirection = "outbound" | "inbound";
export type EmailStatus = "sent" | "failed";

/** A message sent from the CRM (durable send log — see 0025_email.sql). */
export interface Email {
  id: string;
  workspace_id: string;
  direction: EmailDirection;
  message_id: string | null;
  in_reply_to: string | null;
  subject: string | null;
  from_email: string | null;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  body_text: string | null;
  body_html: string | null;
  status: EmailStatus;
  error: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
}
