// Phone-connection constants and helpers shared by Settings, onboarding and /connect-phone.

/** iCloud link to the "Save to Next Action" iPhone shortcut. PLACEHOLDER — replace with the real link. */
export const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/REPLACE-WITH-YOUR-SHORTCUT";

/** n8n workflow that receives saves from the desktop bookmark and Android share. */
export const CAPTURE_URL = "https://vidhikaindustries.app.n8n.cloud/webhook/share-capture";

export const KEY_STORAGE = "na_capture_key";

export type Device = "desktop" | "iphone" | "android" | "inapp";

export function detectDevice(ua: string): Device {
  if (/Instagram|FBAN|FBAV|FB_IAB|LinkedInApp|WhatsApp/i.test(ua)) return "inapp";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function connectUrl(key: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/connect-phone?k=${encodeURIComponent(key)}`;
}

export function shortcutRunUrl(key: string) {
  return `shortcuts://run-shortcut?name=Save%20to%20Next%20Action&input=text&text=${encodeURIComponent(`NAKEY:${key}`)}`;
}

/** Bookmarklet that opens the /share note box in a small window for the current page. */
export function bookmarklet(key: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const js = `(function(){var u=${JSON.stringify(`${origin}/share`)}+'?source=desktop&k='+${JSON.stringify(encodeURIComponent(key))}+'&link='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title);window.open(u,'na_save','width=480,height=420')})()`;
  return `javascript:${encodeURIComponent(js)}`;
}

export function newKey() {
  return crypto.randomUUID().replace(/-/g, "");
}
