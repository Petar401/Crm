"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  CheckSquare,
  NotebookPen,
  FolderOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/lib/constants/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

const NAV_ITEMS: NavItem[] = [
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
  { href: "/tasks", label: "Tasks", icon: CheckSquare, permission: "tasks.view" },
  {
    href: "/notes",
    label: "Notes",
    icon: NotebookPen,
    permission: "notebook.view",
  },
  { href: "/files", label: "Files", icon: FolderOpen, permission: "files.view" },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    permission: "settings.view",
  },
];

export function Sidebar({ allowed }: { allowed: PermissionKey[] }) {
  const pathname = usePathname();
  const allowedSet = new Set(allowed);

  const items = NAV_ITEMS.filter(
    (item) => !item.permission || allowedSet.has(item.permission)
  );

  return (
    <aside className="bg-sidebar hidden w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-bold">
          EA
        </div>
        <span className="text-sm font-semibold">CRM</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
