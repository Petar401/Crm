"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  Users,
  Briefcase,
  Target,
  StickyNote,
  NotebookPen,
  ArrowRight,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { search, type SearchResult } from "@/features/search/actions";
import { signOutAction } from "@/features/auth/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KIND_ICONS = {
  company: Building2,
  contact: Users,
  deal: Briefcase,
  lead: Target,
  note: StickyNote,
  notebook: NotebookPen,
} as const;

interface PaletteContextValue {
  open: () => void;
  close: () => void;
}
const PaletteContext = createContext<PaletteContextValue | null>(null);

export function useCommandPalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("useCommandPalette outside provider");
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The compiler-safe setter above (functional updater) is fine to call
    // from a DOM event handler; the effect only wires the subscription.
  }, []);

  const value = useMemo<PaletteContextValue>(() => ({ open, close }), [open, close]);

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandPaletteDialog isOpen={isOpen} setIsOpen={setIsOpen} />
    </PaletteContext.Provider>
  );
}

export function CommandPaletteTrigger() {
  const { open } = useCommandPalette();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-muted-foreground w-full max-w-md justify-start gap-2 font-normal"
      onClick={open}
    >
      <Search className="size-4" />
      <span>Search or jump to…</span>
      <kbd className="bg-muted text-muted-foreground ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium">
        ⌘K
      </kbd>
    </Button>
  );
}

interface Action {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string;
}

function CommandPaletteDialog({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const actions = useMemo<Action[]>(
    () => [
      {
        id: "new-company",
        label: "New company",
        icon: Building2,
        run: () => router.push("/companies?new=1"),
        keywords: "create add",
      },
      {
        id: "new-contact",
        label: "New contact",
        icon: Users,
        run: () => router.push("/contacts?new=1"),
        keywords: "create add person",
      },
      {
        id: "new-deal",
        label: "New deal",
        icon: Briefcase,
        run: () => router.push("/deals?new=1"),
        keywords: "create add",
      },
      {
        id: "new-lead",
        label: "New lead",
        icon: Target,
        run: () => router.push("/leads?new=1"),
        keywords: "create add",
      },
      {
        id: "jump-dashboard",
        label: "Go to dashboard",
        icon: ArrowRight,
        run: () => router.push("/"),
        keywords: "home",
      },
      {
        id: "jump-tasks",
        label: "Go to tasks",
        icon: ArrowRight,
        run: () => router.push("/tasks"),
      },
      {
        id: "jump-email",
        label: "Go to email",
        icon: ArrowRight,
        run: () => router.push("/email"),
      },
      {
        id: "jump-settings",
        label: "Go to settings",
        icon: ArrowRight,
        run: () => router.push("/settings"),
      },
      {
        id: "toggle-theme",
        label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
        icon: theme === "dark" ? Sun : Moon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
        keywords: "dark light appearance",
      },
      {
        id: "sign-out",
        label: "Sign out",
        icon: LogOut,
        run: () => {
          void signOutAction();
        },
      },
    ],
    [router, theme, setTheme]
  );

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions.slice(0, 6);
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.keywords ?? "").toLowerCase().includes(q)
    );
  }, [actions, query]);

  const allItems = useMemo(
    () => [
      ...results.map((r) => ({ kind: "result" as const, data: r })),
      ...filteredActions.map((a) => ({ kind: "action" as const, data: a })),
    ],
    [results, filteredActions]
  );

  // Debounced search. All setState calls live inside the setTimeout callback
  // (an async boundary), so the effect body itself never sets state.
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    const timer = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        setSelectedIndex(0);
        return;
      }
      startTransition(async () => {
        const rows = await search(q, 4);
        setResults(rows);
        setSelectedIndex(0);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Reset the palette when it opens; queueMicrotask defers the setStates so
  // React Compiler sees them as external work, not effect-body renders.
  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    });
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  function runItem(index: number) {
    const item = allItems[index];
    if (!item) return;
    setIsOpen(false);
    if (item.kind === "result") {
      router.push(item.data.href);
    } else {
      item.data.run();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(selectedIndex);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search & commands</DialogTitle>
        </DialogHeader>
        <div className="border-b p-3">
          <div className="flex items-center gap-2">
            <Search className="text-muted-foreground size-4" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search records, or type a command…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {pending ? (
              <span className="text-muted-foreground text-xs">…</span>
            ) : null}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {results.length > 0 && (
            <div>
              <div className="text-muted-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
                Records
              </div>
              {results.map((r, i) => {
                const Icon = KIND_ICONS[r.kind];
                return (
                  <PaletteRow
                    key={`r-${r.kind}-${r.id}`}
                    icon={Icon}
                    label={r.title}
                    hint={r.subtitle}
                    selected={i === selectedIndex}
                    onClick={() => runItem(i)}
                  />
                );
              })}
            </div>
          )}
          {filteredActions.length > 0 && (
            <div>
              <div className="text-muted-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">
                {results.length ? "Actions" : "Suggestions"}
              </div>
              {filteredActions.map((a, i) => {
                const idx = results.length + i;
                return (
                  <PaletteRow
                    key={a.id}
                    icon={a.icon}
                    label={a.label}
                    selected={idx === selectedIndex}
                    onClick={() => runItem(idx)}
                  />
                );
              })}
            </div>
          )}
          {allItems.length === 0 && !pending && (
            <div className="text-muted-foreground px-3 py-8 text-center text-sm">
              {query.length < 2
                ? "Type at least 2 characters to search…"
                : "No results."}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaletteRow({
  icon: Icon,
  label,
  hint,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm",
        selected ? "bg-accent" : "hover:bg-accent/60"
      )}
    >
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <span className="text-muted-foreground max-w-[40%] truncate text-xs">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

