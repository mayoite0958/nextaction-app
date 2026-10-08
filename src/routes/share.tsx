import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CAPTURE_URL, KEY_STORAGE } from "@/lib/phone";

// Receives links from Android Share and the desktop bookmark, asks for a note, then sends to n8n.
export const Route = createFileRoute("/share")({
  validateSearch: z.object({
    link: z.string().optional(),
    text: z.string().optional(),
    title: z.string().optional(),
    source: z.enum(["android", "desktop"]).optional(),
    k: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Save to Next Action" },
      { name: "description", content: "Save a link to Next Action with a short note." },
      { property: "og:title", content: "Save to Next Action" },
      { property: "og:description", content: "Save a link to Next Action with a short note." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { link: shared, text, title, source, k } = Route.useSearch();
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [projectId, setProjectId] = useState<string>("auto");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const link = shared || text?.match(/https?:\/\/\S+/)?.[0] || text || "";

  useEffect(() => {
    if (k) localStorage.setItem(KEY_STORAGE, k);
    setKey(k || localStorage.getItem(KEY_STORAGE));
  }, [k]);

  useEffect(() => {
    if (!key) return;
    void fetch("/api/public/share-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    })
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d: { projects?: { id: string; name: string }[] }) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, [key]);

  async function send() {
    if (!key) return;
    setSending(true);
    try {
      const r = await fetch("/api/public/share-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          url: link,
          note: "",
          project_id: projectId === "auto" ? null : projectId,
          title: title ?? "",
          source: source ?? "android",
        }),
      });
      const body = (await r.text()).trim();
      setResult(r.ok ? { ok: true, msg: body || "Saved." } : { ok: false, msg: "Couldn't save — please try again." });
    } catch {
      setResult({ ok: false, msg: "Couldn't save — check your connection." });
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <p className="font-display text-base font-bold">
        Next<span className="text-primary">Action</span>
      </p>
      {key === undefined ? null : !key ? (
        <p className="mt-6 text-sm">
          This device isn't connected yet. Open Settings → Connect your phone first.
        </p>
      ) : result?.ok ? (
        <p className="mt-6 text-lg">✅ {result.msg}</p>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium">{title || link}</p>
          {title && <p className="break-all text-xs text-muted-foreground">{link}</p>}
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Project</span>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Let AI pick</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button onClick={send} className="w-full" disabled={sending || !link}>
            {sending ? "Saving…" : "Save"}
          </Button>
          {result && !result.ok && <p className="text-sm text-destructive">{result.msg}</p>}
        </div>
      )}
    </main>
  );
}
