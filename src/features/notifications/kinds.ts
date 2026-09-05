import type { NotificationKind } from "@/lib/db/types";

export const NOTIFICATION_KINDS: NotificationKind[] = [
  "task_assigned",
  "task_due_soon",
  "deal_stage_changed",
  "deal_won",
  "mention",
  "lead_scored",
  "campaign_finished",
  "email_received",
  "workspace_invited",
  "member_joined",
  "quote_signed",
  "invoice_paid",
  "invoice_overdue",
  "booking_created",
];

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  task_assigned: "Task assigned to me",
  task_due_soon: "Task due soon",
  deal_stage_changed: "Deal moved to a new stage",
  deal_won: "Deal won",
  mention: "You are @mentioned",
  lead_scored: "New high-scoring lead",
  campaign_finished: "Lead campaign finished",
  email_received: "Email received",
  workspace_invited: "Invited to a workspace",
  member_joined: "New teammate joined",
  quote_signed: "Quote signed by customer",
  invoice_paid: "Invoice paid",
  invoice_overdue: "Invoice overdue",
  booking_created: "New booking on your calendar link",
};

export const DEFAULT_IN_APP: Set<NotificationKind> = new Set(NOTIFICATION_KINDS);
