import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { youtubeThumb, youtubeWatchUrl } from "@/lib/youtube";
import { openExternal } from "@/lib/open-external";
import { daysSince } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Highlighted saved resource for the recommended step. */
export function ResurfaceCard({ id, onOpen }: { id: string | null; onOpen: () => void }) {
  const q = useQuery({
    queryKey: ["resource", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!id || !q.data) return null;
  const r = q.data;
  const thumb = youtubeThumb(r.url);
  const days = daysSince(r.created_at);
  const ago = days == null ? "" : days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  return (
    <div className="resurface-glow rounded-xl border border-primary/60 bg-primary/10 p-3">
      <div className="flex gap-3">
        {thumb ? (
          <img src={thumb} alt="" className="aspect-video w-24 shrink-0 rounded-md object-cover sm:w-32" loading="lazy" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-background/60 text-primary">
            <Link2 className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words font-medium leading-snug">{r.title || r.url}</p>
          {r.resource_type && <Badge variant="outline" className="mt-1 border-primary/60 text-primary">{r.resource_type}</Badge>}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        You saved this {ago || "earlier"}.
        {r.problem_helped && <> It helps with: <span className="text-foreground">{r.problem_helped}</span></>}
      </p>
      {r.url && (
        <Button
          size="sm"
          className="mt-3 w-full sm:w-auto"
          onClick={() => {
            openExternal(youtubeWatchUrl(r.url!));
            onOpen();
          }}
        >
          Open ↗
        </Button>
      )}
    </div>
  );
}
