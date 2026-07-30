"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

import {
  createApiToken,
  revokeApiToken,
} from "@/features/api-tokens/actions";
import type { ApiTokenListItem } from "@/features/api-tokens/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  tokens: ApiTokenListItem[];
  mcpUrl: string;
}

export function ConnectorsPanel({ tokens, mcpUrl }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createApiToken({ name });
      if (result.error || !result.token) {
        toast.error(result.error ?? "Could not create token");
        return;
      }
      setFreshToken(result.token);
      setName("");
      router.refresh();
    });
  }

  function closeCreate() {
    setCreateOpen(false);
    setFreshToken(null);
    setCopied(false);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeApiToken(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Token revoked");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-muted-foreground text-sm">
          Connect Claude Desktop with the button below — no token needed; you
          sign in and approve in your browser. Personal access tokens remain
          available for scripts and other clients. Every action runs under your
          permissions.
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => (open ? setCreateOpen(true) : closeCreate())}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              New token
            </Button>
          </DialogTrigger>
          <DialogContent>
            {freshToken ? (
              <>
                <DialogHeader>
                  <DialogTitle>Copy your token</DialogTitle>
                  <DialogDescription>
                    This is the only time you&apos;ll see it. Store it in your
                    Claude Desktop connector settings now.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Label>Token</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={freshToken} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copy(freshToken)}
                    >
                      {copied ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                  <Label>MCP endpoint</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={mcpUrl} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copy(mcpUrl)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={closeCreate}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>Create personal access token</DialogTitle>
                  <DialogDescription>
                    Name it so you can identify where it&apos;s used
                    (&quot;Claude Desktop&quot;, &quot;My laptop&quot;).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <Label htmlFor="token-name">Name</Label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Claude Desktop"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending || !name.trim()}>
                    {pending ? "Creating…" : "Create token"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {tokens.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          No tokens yet.
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{token.name}</div>
                <div className="text-muted-foreground truncate font-mono text-xs">
                  {token.token_prefix}…
                </div>
                <div className="text-muted-foreground text-xs">
                  Created {new Date(token.created_at).toLocaleDateString()}
                  {token.last_used_at
                    ? ` · Last used ${new Date(token.last_used_at).toLocaleString()}`
                    : " · Never used"}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label="Revoke token"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Any client using it (including Claude Desktop) will lose
                      access immediately. This can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => revoke(token.id)}>
                      Revoke
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <div className="text-muted-foreground rounded-md border bg-muted/30 p-4 text-xs">
        <div className="mb-1 font-medium text-foreground">
          Connect Claude Desktop
        </div>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            In Claude Desktop → Settings → Connectors, add a custom connector
            with the URL <code className="font-mono">{mcpUrl}</code>.
          </li>
          <li>
            Click Connect — you&apos;ll be sent here to sign in and approve
            access. No token to copy.
          </li>
          <li>
            Ask Claude &quot;list my companies&quot; to confirm the connection.
          </li>
        </ol>
        <div className="mt-2">
          Prefer a manual token (for scripts or other clients)? Create one above
          and send it as a <code className="font-mono">Bearer</code> credential
          to the same URL.
        </div>
      </div>
    </div>
  );
}
