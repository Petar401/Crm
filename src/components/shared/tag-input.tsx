"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  id?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}

/** Minimal chip/tag input: type + Enter or comma to add, backspace to remove last. */
export function TagInput({ id, placeholder, values, onChange }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="focus-within:ring-ring flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1">
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        id={id}
        placeholder={values.length ? undefined : placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        className="h-6 min-w-24 flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
