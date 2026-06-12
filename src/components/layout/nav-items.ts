import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  CheckSquare,
  NotebookPen,
  FolderOpen,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { PermissionKey } from "@/lib/constants/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
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
