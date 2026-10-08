// Phone-connection constants and helpers shared by Settings, onboarding and /connect-phone.

/** iCloud link to the "Save to Next Action" iPhone shortcut. */
export const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/c1cb976872ac4dbe9419bef43f098866";

/** n8n workflow that receives saves from the desktop bookmark and Android share. */
export const CAPTURE_URL = "https://vidhikaindustries.app.n8n.cloud/webhook/share-capture";

export const KEY_STORAGE = "na_capture_key";

/** Production address used in every link users see (QR, bookmarklet, sign-up emails). */
export const APP_ORIGIN = "https://nextaction-app.lovable.app";

export type Device = "desktop" | "iphone" | "android" | "inapp";

export function detectDevice(ua: string): Device {
  if (/Instagram|FBAN|FBAV|FB_IAB|LinkedInApp|WhatsApp/i.test(ua)) return "inapp";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function connectUrl(key: string) {
  const origin = APP_ORIGIN;
  return `${origin}/connect-phone?k=${encodeURIComponent(key)}`;
}

export function shortcutRunUrl(key: string) {
  return `shortcuts://run-shortcut?name=Save%20to%20Next%20Action&input=text&text=${encodeURIComponent(`NAKEY:${key}`)}`;
}

/** Bookmarklet that opens the /share note box in a small window for the current page. */
export function bookmarklet(key: string) {
  const origin = APP_ORIGIN;
  // Falls back to opening in the same tab when the popup is blocked.
  const js = `(function(){var u='${origin}/share?source=desktop&k=${encodeURIComponent(key)}&link='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title);var w=window.open(u,'na_save','width=480,height=420');if(!w){location.href=u}})();void 0`;
  return `javascript:${js.replace(/ /g, "%20")}`;
}

export function newKey() {
  return crypto.randomUUID().replace(/-/g, "");
}
