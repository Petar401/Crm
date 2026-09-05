"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { bookSlot } from "@/features/scheduling/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  slug: string;
  startAtISO: string;
  duration: number;
  ownerName: string;
}

export function BookForm({ slug, startAtISO, duration, ownerName }: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [state, setState] = useState({
    name: "",
    email: "",
    notes: "",
  });

  function submit() {
    startTransition(async () => {
      const r = await bookSlot({
        slug,
        start_at: startAtISO,
        invitee_name: state.name,
        invitee_email: state.email,
        invitee_notes: state.notes,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Booked! A calendar hold for {ownerName} has been created and{" "}
        {ownerName} has been notified. You&apos;ll get a confirmation email at{" "}
        {state.email}.
      </div>
    );
  }

  const readable = new Date(startAtISO).toLocaleString();

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-blue-50 p-3 text-sm">
        Booking a {duration}-minute slot with <strong>{ownerName}</strong> on{" "}
        <strong>{readable}</strong>.
      </div>
      <div>
        <Label>Your name</Label>
        <Input
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
        />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
        />
      </div>
      <div>
        <Label>What&apos;s this about?</Label>
        <Textarea
          rows={3}
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
        />
      </div>
      <Button
        onClick={submit}
        disabled={pending || !state.name || !state.email}
      >
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </div>
  );
}
