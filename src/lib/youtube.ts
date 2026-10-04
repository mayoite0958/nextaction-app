// YouTube helpers: extract a video id from any common YouTube URL shape
// and build its thumbnail URL. No API key needed — thumbnails are public.

export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/) ??
    url.match(/^([\w-]{11})$/);
  return m?.[1] ?? null;
}

export function youtubeThumb(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function youtubeWatchUrl(url: string): string {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : url;
}
