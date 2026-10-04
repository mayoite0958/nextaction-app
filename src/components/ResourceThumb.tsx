import { youtubeThumb, youtubeWatchUrl } from "@/lib/youtube";
import { openExternal } from "@/lib/open-external";

/** Small YouTube thumbnail that always opens the video in a new browser tab. */
export function ResourceThumb({ url, title }: { url: string | null; title?: string | null }) {
  const thumb = youtubeThumb(url);
  if (!url || !thumb) return null;
  const watch = youtubeWatchUrl(url);
  return (
    <a
      href={watch}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        openExternal(watch);
      }}
      className="relative block w-28 shrink-0 overflow-hidden rounded-md sm:w-32"
      title="Open on YouTube"
    >
      <img src={thumb} alt={title ?? "YouTube video"} className="aspect-video w-full object-cover" loading="lazy" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-[10px] text-primary">▶</span>
      </span>
    </a>
  );
}

/** Plain link that opens in a new tab. */
export function ExternalLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        openExternal(url);
      }}
      className="break-all text-primary underline"
    >
      {url}
    </a>
  );
}
