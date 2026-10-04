import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ProjectResources({ projectId }: { projectId: string }) {
  const q = useQuery({
    queryKey: ["resources", "project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  return (
    <section className="panel mt-8 p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
        Saved resources for this project
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {q.isLoading ? "Loading…" : "Nothing saved yet. Add links on the Resources page."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-3">
              <p className="font-medium">
                {r.title || r.url}
                {r.resource_type && <span className="ml-2 text-muted-foreground">{r.resource_type}</span>}
              </p>
              {r.problem_helped && <p className="text-muted-foreground">{r.problem_helped}</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="break-all text-primary underline">
                  {r.url}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
