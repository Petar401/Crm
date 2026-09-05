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
  | "quote_signed"
  | "invoice_paid"
  | "invoice_overdue"
  | "booking_created"
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

// ---------------------------------------------------------------------------
// Products, price books, tax rates (0029_products.sql)
// ---------------------------------------------------------------------------

export type ProductKind = "one_time" | "recurring";
export type RecurringInterval = "day" | "week" | "month" | "year";

export interface TaxRate {
  id: string;
  workspace_id: string;
  name: string;
  rate_bps: number;
  region: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  workspace_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  kind: ProductKind;
  recurring_interval: RecurringInterval | null;
  unit: string;
  default_currency: string;
  default_price: number;
  default_tax_rate_id: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceBook {
  id: string;
  workspace_id: string;
  name: string;
  currency: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriceBookEntry {
  id: string;
  price_book_id: string;
  product_id: string;
  unit_price: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Quotes (0030_quotes.sql)
// ---------------------------------------------------------------------------

export type QuoteStatus = "draft" | "sent" | "signed" | "expired" | "void";

export interface Quote {
  id: string;
  workspace_id: string;
  number: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  status: QuoteStatus;
  currency: string;
  subtotal_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  valid_until: string | null;
  notes: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_email: string | null;
  signed_ip: string | null;
  signature_svg: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  product_id: string | null;
  position: number;
  description: string;
  quantity: number;
  unit_price_minor: number;
  discount_bps: number;
  tax_rate_id: string | null;
  tax_rate_bps: number;
  line_subtotal_minor: number;
  line_tax_minor: number;
  line_total_minor: number;
  created_at: string;
}

export interface QuoteShareToken {
  id: string;
  quote_id: string;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Billing invoices (0031_billing_invoices.sql) — real invoice objects, distinct
// from the receipt cabinet in `invoices` (0019_invoices.sql).
// ---------------------------------------------------------------------------

export type BillingInvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void";

export interface BillingInvoice {
  id: string;
  workspace_id: string;
  number: string;
  deal_id: string | null;
  quote_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  status: BillingInvoiceStatus;
  currency: string;
  subtotal_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  memo: string | null;
  external_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoiceLine {
  id: string;
  billing_invoice_id: string;
  product_id: string | null;
  position: number;
  description: string;
  quantity: number;
  unit_price_minor: number;
  discount_bps: number;
  tax_rate_id: string | null;
  tax_rate_bps: number;
  line_subtotal_minor: number;
  line_tax_minor: number;
  line_total_minor: number;
  created_at: string;
}

export interface BillingPayment {
  id: string;
  billing_invoice_id: string;
  workspace_id: string;
  amount_minor: number;
  currency: string;
  method: string | null;
  external_ref: string | null;
  paid_at: string;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Calendar events (0033_calendar_events.sql)
// ---------------------------------------------------------------------------

export type CalendarEventSource = "internal" | "google" | "microsoft";
export type CalendarEventStatus = "confirmed" | "cancelled";
export type AttendeeResponse =
  | "needs_action"
  | "accepted"
  | "declined"
  | "tentative";

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string | null;
  status: CalendarEventStatus;
  source: CalendarEventSource;
  external_id: string | null;
  external_etag: string | null;
  external_calendar_id: string | null;
  rrule: string | null;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventAttendee {
  id: string;
  event_id: string;
  contact_id: string | null;
  user_id: string | null;
  email: string;
  name: string | null;
  response: AttendeeResponse;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Scheduling links + bookings (0035_scheduling_links.sql)
// ---------------------------------------------------------------------------

export interface AvailabilityWindow {
  start: string; // "09:00"
  end: string;   // "17:00"
}

export type Availability = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", AvailabilityWindow[]>
>;

export interface SchedulingLink {
  id: string;
  workspace_id: string;
  owner_user_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  timezone: string;
  availability: Availability;
  min_notice_minutes: number;
  max_days_ahead: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  id: string;
  scheduling_link_id: string;
  calendar_event_id: string | null;
  invitee_name: string;
  invitee_email: string;
  invitee_notes: string | null;
  contact_id: string | null;
  status: BookingStatus;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Stripe billing settings (0032_stripe.sql) — behind a per-workspace flag.
// ---------------------------------------------------------------------------

export interface WorkspaceBillingSettings {
  workspace_id: string;
  stripe_enabled: boolean;
  stripe_publishable_key: string | null;
  encrypted_stripe_secret_key: string | null;
  webhook_secret: string | null;
  webhook_endpoint_slug: string | null;
  auto_invoice_on_won: boolean;
  send_dunning: boolean;
  dunning_schedule_days: number[];
  tax_inclusive: boolean;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "paused";

export interface Subscription {
  id: string;
  workspace_id: string;
  company_id: string | null;
  product_id: string | null;
  quantity: number;
  currency: string;
  interval: RecurringInterval;
  external_ref: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Calendar sync accounts (0034_calendar_accounts.sql)
// ---------------------------------------------------------------------------

export type CalendarProvider = "google" | "microsoft";

export interface CalendarAccount {
  id: string;
  user_id: string;
  workspace_id: string;
  provider: CalendarProvider;
  external_account_email: string;
  external_calendar_id: string;
  encrypted_tokens: string;
  sync_token: string | null;
  channel_id: string | null;
  channel_resource_id: string | null;
  channel_expiry: string | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarOAuthState {
  id: string;
  user_id: string;
  workspace_id: string;
  provider: CalendarProvider;
  state: string;
  code_verifier: string | null;
  expires_at: string;
  created_at: string;
}
