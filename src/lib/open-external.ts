import { toast } from "sonner";

/**
 * Opens a link in a brand-new browser tab, never inside the app's frame.
 * Sites like YouTube refuse to load inside frames, so this forces a real tab.
 * If the browser blocks the new tab, the link is copied so it can be pasted.
 */
export function openExternal(url: string) {
  let w: Window | null = null;
  try {
    w = window.open(url, "_blank");
  } catch {
    w = null;
  }
  if (w) {
    try {
      w.opener = null;
    } catch {
      /* ignore */
    }
    return;
  }
  navigator.clipboard
    ?.writeText(url)
    .then(() => toast("Your browser blocked the new tab — link copied, paste it into a new tab."))
    .catch(() => toast(`Open this link in a new tab: ${url}`));
}
