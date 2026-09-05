"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { signQuote } from "@/features/quotes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  token: string;
  quoteNumber: string;
}

export function QuoteSignForm({ token, quoteNumber }: Props) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState(false);

  function submit() {
    if (!accepted) {
      toast.error("Tick the box to accept");
      return;
    }
    // Signature = an SVG rendering of the typed name. We store it so the
    // sign-off is auditable without the customer having to draw with a mouse.
    const signature = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80"><text x="10" y="55" font-family="cursive" font-size="42">${escapeSvg(
      name
    )}</text></svg>`;
    startTransition(async () => {
      const r = await signQuote({
        token,
        name,
        email,
        signature_svg: signature,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Quote accepted — thanks!");
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Quote {quoteNumber} accepted. The sender has been notified.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Accept quote {quoteNumber}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Full name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
          />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1"
        />
        <span>
          I confirm that I have authority to accept this quote on behalf of the
          named business, and that typing my name here counts as my signature.
        </span>
      </label>
      <Button onClick={submit} disabled={pending || !name || !email}>
        {pending ? "Signing…" : "Sign and accept"}
      </Button>
    </div>
  );
}

function escapeSvg(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
