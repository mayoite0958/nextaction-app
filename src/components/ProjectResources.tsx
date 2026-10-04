import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { youtubeThumb, youtubeWatchUrl } from "@/lib/youtube";

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
            <li key={r.id} className="overflow-hidden rounded-md border border-border">
              {youtubeThumb(r.url) && (
                <a href={r.url!} target="_blank" rel="noreferrer" className="relative block">
                  <img
                    src={youtubeThumb(r.url)!}
                    alt={r.title ?? "YouTube video"}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-primary">▶</span>
                  </span>
                </a>
              )}
              <div className="p-3">
                <p className="font-medium">
                  {r.title || r.url}
                  {r.resource_type && <span className="ml-2 text-muted-foreground">{r.resource_type}</span>}
                </p>
                {r.problem_helped && <p className="text-muted-foreground">{r.problem_helped}</p>}
                {r.url && !youtubeThumb(r.url) && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="break-all text-primary underline">
                    {r.url}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
