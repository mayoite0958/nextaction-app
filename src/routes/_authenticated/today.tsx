import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { SplitBar } from "@/components/SplitBar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { daysLeft, relativeTime } from "@/lib/nextaction";
import type { Database } from "@/integrations/supabase/types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Next Action" },
      {
        name: "description",
        content: "Your active projects, closest deadlines first, and your urgent/long-term balance.",
      },
      { property: "og:title", content: "Today — Next Action" },
      {
        property: "og:description",
        content: "Your active projects, closest deadlines first, and your urgent/long-term balance.",
      },
    ],
  }),
  component: Today,
});

function Today() {
  const navigate = useNavigate();

  const settingsQuery = useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const settings = settingsQuery.data;

  useEffect(() => {
    if (settingsQuery.isSuccess && !settings) navigate({ to: "/onboarding", replace: true });
  }, [settingsQuery.isSuccess, settings, navigate]);

  if (settingsQuery.isLoading || !settings) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading your day…</p>
      </AppShell>
    );
  }

  const urgentLabel = settings.bucket_urgent_label ?? "Urgent";
  const longtermLabel = settings.bucket_longterm_label ?? "Long-term";
  const projects = projectsQuery.data ?? [];

  return (
    <AppShell>
      <h1 className="text-3xl font-bold">
        {settings.display_name ? `Today, ${settings.display_name}` : "Today"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Optimising for {settings.value_label ?? "what matters to you"}.
      </p>

      <div className="mt-6">
        <SplitBar
          urgentShare={settings.urgent_share ?? 70}
          urgentLabel={urgentLabel}
          longtermLabel={longtermLabel}
        />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Active projects
      </h2>

      {projectsQuery.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No active projects yet. Add some and they'll show up here.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {projects.map((p: ProjectRow) => {
            const left = daysLeft(p.deadline);
            const urgentBucket = p.bucket !== "long_term";
            return (
              <article key={p.id} className="panel flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold leading-tight">{p.name}</h3>
                  <Badge
                    className={
                      urgentBucket
                        ? "bg-urgent text-urgent-foreground"
                        : "bg-longterm text-longterm-foreground"
                    }
                  >
                    {urgentBucket ? urgentLabel : longtermLabel}
                  </Badge>
                </div>

                {p.goal && <p className="text-sm text-muted-foreground">{p.goal}</p>}

                <p className="text-sm">
                  {left === null ? (
                    <span className="text-muted-foreground">No deadline</span>
                  ) : (
                    <span
                      className={
                        left <= 2 ? "font-semibold text-destructive" : "text-muted-foreground"
                      }
                    >
                      {left < 0
                        ? `${Math.abs(left)} days overdue`
                        : left === 0
                          ? "Due today"
                          : `${left} days left`}
                    </span>
                  )}
                </p>

                <dl className="space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Value</dt>
                    <dd>{p.value_score ?? 3}/5</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Blocker</dt>
                    <dd>{p.blocker || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Next action</dt>
                    <dd>{p.next_likely_action || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Last worked</dt>
                    <dd>{relativeTime(p.last_worked_at)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
