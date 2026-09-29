import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { COACHING_TONES, ROLE_TEMPLATES, TIMEZONES } from "@/lib/nextaction";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Next Action" },
      { name: "description", content: "Change how Next Action prioritises and talks to you." },
      { property: "og:title", content: "Settings — Next Action" },
      {
        property: "og:description",
        content: "Change how Next Action prioritises and talks to you.",
      },
    ],
  }),
  component: SettingsPage;
});

type Form = {
  display_name: string;
  role_template: string;
  timezone: string;
  urgent_share: number;
  bucket_urgent_label: string;
  bucket_longterm_label: string;
  value_label: string;
  priority_notes: string;
  coaching_tone: string;
  reply_language: string;
  guard_mode: string;
  distraction_sites: string;
  session_lengths: string;
  morning_brief_enabled: boolean;
  morning_brief_time: string;
  whatsapp_number: string;
  email_forward_tag: string;
};

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const row = settingsQuery.data;

  useEffect(() => {
    if (settingsQuery.isSuccess && !row) navigate({ to: "/onboarding", replace: true });
  }, [settingsQuery.isSuccess, row, navigate]);

  useEffect(() => {
    if (!row || form) return;
    setForm({
      display_name: row.display_name ?? "",
      role_template: row.role_template ?? "custom",
      timezone: row.timezone ?? "Asia/Kolkata",
      urgent_share: row.urgent_share ?? 70,
      bucket_urgent_label: row.bucket_urgent_label ?? "Urgent",
      bucket_longterm_label: row.bucket_longterm_label ?? "Long-term",
      value_label: row.value_label ?? "",
      priority_notes: row.priority_notes ?? "",
      coaching_tone: row.coaching_tone ?? "direct",
      reply_language: row.reply_language ?? "English",
      guard_mode: row.guard_mode ?? "self_report",
      distraction_sites: (row.distraction_sites ?? []).join(", "),
      session_lengths: (row.session_lengths ?? []).join(", "),
      morning_brief_enabled: row.morning_brief_enabled ?? false,
      morning_brief_time: (row.morning_brief_time ?? "08:30:00").slice(0, 5),
      whatsapp_number: row.whatsapp_number ?? "",
      email_forward_tag: row.email_forward_tag ?? "",
    });
  }, [row, form]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You are signed out.");
      const { error } = await supabase
        .from("user_settings")
        .update({
          display_name: form.display_name.trim() || null,
          role_template: form.role_template,
          timezone: form.timezone,
          urgent_share: form.urgent_share,
          bucket_urgent_label: form.bucket_urgent_label,
          bucket_longterm_label: form.bucket_longterm_label,
          value_label: form.value_label.trim() || null,
          priority_notes: form.priority_notes.trim() || null,
          coaching_tone: form.coaching_tone,
          reply_language: form.reply_language,
          guard_mode: form.guard_mode,
          distraction_sites: splitList(form.distraction_sites),
          session_lengths: splitList(form.session_lengths)
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0),
          morning_brief_enabled: form.morning_brief_enabled,
          morning_brief_time: `${form.morning_brief_time}:00`,
          whatsapp_number: form.whatsapp_number.trim() || null,
          email_forward_tag: form.email_forward_tag.trim() || null,
        })
        .eq("user_id", uid);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["user_settings"] });
      toast.success("Settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEverything() {
    setDeleting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You are signed out.");
      for (const table of [
        "activity",
        "sessions",
        "resources",
        "urgent_items",
        "projects",
        "user_settings",
      ] as const) {
        const { error } = await supabase.from(table).delete().eq("user_id", uid);
        if (error) throw error;
      }
      queryClient.clear();
      toast.success("All your data has been deleted.");
      navigate({ to: "/onboarding", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete your data");
    } finally {
      setDeleting(false);
    }
  }

  if (!form) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Settings</h1>

      <section className="panel mt-6 space-y-5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          You
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Your name</Label>
            <Input
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role template</Label>
            <Select
              value={form.role_template}
              onValueChange={(v) => {
                set("role_template", v);
                const t = ROLE_TEMPLATES.find((x) => x.id === v);
                if (t && v !== "custom") {
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          role_template: v,
                          bucket_urgent_label: t.urgentLabel,
                          bucket_longterm_label: t.longtermLabel,
                          urgent_share: t.urgentShare,
                          value_label: t.valueLabel,
                        }
                      : f,
                  );
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reply language</Label>
            <Input
              value={form.reply_language}
              onChange={(e) => set("reply_language", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="panel mt-6 space-y-5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Priorities
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Urgent category name</Label>
            <Input
              value={form.bucket_urgent_label}
              onChange={(e) => set("bucket_urgent_label", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Long-term category name</Label>
            <Input
              value={form.bucket_longterm_label}
              onChange={(e) => set("bucket_longterm_label", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-3">
          <Label>
            Split: {form.urgent_share}% {form.bucket_urgent_label} / {100 - form.urgent_share}%{" "}
            {form.bucket_longterm_label}
          </Label>
          <Slider
            value={[form.urgent_share]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => set("urgent_share", v[0])}
          />
        </div>
        <div className="space-y-2">
          <Label>What you're optimising for</Label>
          <Input value={form.value_label} onChange={(e) => set("value_label", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Priority notes</Label>
          <Textarea
            rows={3}
            value={form.priority_notes}
            onChange={(e) => set("priority_notes", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Session lengths (minutes, comma separated)</Label>
          <Input
            value={form.session_lengths}
            onChange={(e) => set("session_lengths", e.target.value)}
          />
        </div>
      </section>

      <section className="panel mt-6 space-y-5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Coaching & focus
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Coaching tone</Label>
            <Select value={form.coaching_tone} onValueChange={(v) => set("coaching_tone", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COACHING_TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Focus check mode</Label>
            <Select value={form.guard_mode} onValueChange={(v) => set("guard_mode", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self_report">I report it myself</SelectItem>
                <SelectItem value="tracked">Track my activity</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Distracting sites (comma separated)</Label>
          <Input
            value={form.distraction_sites}
            onChange={(e) => set("distraction_sites", e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Morning brief</Label>
            <p className="text-sm text-muted-foreground">A short plan at the start of your day.</p>
          </div>
          <Switch
            checked={form.morning_brief_enabled}
            onCheckedChange={(v) => set("morning_brief_enabled", v)}
          />
        </div>
        <div className="space-y-2 sm:max-w-40">
          <Label>Brief time</Label>
          <Input
            type="time"
            value={form.morning_brief_time}
            onChange={(e) => set("morning_brief_time", e.target.value)}
          />
        </div>
      </section>

      <section className="panel mt-6 space-y-5 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Channels
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>WhatsApp number</Label>
            <Input
              value={form.whatsapp_number}
              onChange={(e) => set("whatsapp_number", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email forwarding tag</Label>
            <Input
              value={form.email_forward_tag}
              onChange={(e) => set("email_forward_tag", e.target.value)}
            />
          </div>
        </div>
        {row?.whatsapp_verified && (
          <p className="text-sm text-muted-foreground">WhatsApp number verified.</p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              Delete all my data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your settings, projects, saved links, work sessions and
                activity. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my data</AlertDialogCancel>
              <AlertDialogAction onClick={deleteEverything}>Yes, delete it all</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
