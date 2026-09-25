import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  CheckSquare,
  NotebookPen,
  FolderOpen,
  Receipt,
  Settings,
  Sparkles,
  Target,
  Mail,
  Package,
  FileText,
  CreditCard,
  Calendar,
  MapPin,
  type LucideIcon,
} from "lucide-react";

import type { PermissionKey } from "@/lib/constants/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user holds this permission. */
  permission?: PermissionKey;
  /** Shown when the user holds ANY of these permissions (overrides `permission`). */
  permissions?: PermissionKey[];
}

/** Whether a nav item should be shown to a user with this permission set. */
export function isNavItemVisible(
  item: NavItem,
  allowed: ReadonlySet<PermissionKey>
): boolean {
  if (item.permissions) return item.permissions.some((p) => allowed.has(p));
  return !item.permission || allowed.has(item.permission);
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/companies",
    label: "Companies",
    icon: Building2,
    permission: "companies.view",
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
    permission: "contacts.view",
  },
  { href: "/deals", label: "Deals", icon: Briefcase, permission: "deals.view" },
  {
    href: "/leads",
    label: "Leads",
    icon: Target,
    permission: "leads.view",
  },
  {
    href: "/map",
    label: "Map",
    icon: MapPin,
    permissions: ["companies.view", "leads.view"],
  },
  {
    href: "/email",
    label: "Email",
    icon: Mail,
    permission: "email.view",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
    permission: "tasks.view",
  },
  {
    href: "/notes",
    label: "Notes",
    icon: NotebookPen,
    permission: "notebook.view",
  },
  {
    href: "/files",
    label: "Files",
    icon: FolderOpen,
    permission: "files.view",
  },
  {
    href: "/invoices",
    label: "Receipts",
    icon: Receipt,
    permission: "invoices.view",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    permission: "products.view",
  },
  {
    href: "/quotes",
    label: "Quotes",
    icon: FileText,
    permission: "quotes.view",
  },
  {
    href: "/billing",
    label: "Billing",
    icon: CreditCard,
    permission: "billing.view",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: Calendar,
    permission: "calendar.view",
  },
  {
    href: "/aria",
    label: "Aria",
    icon: Sparkles,
    permission: "ai.use",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings.view",
  },
];
