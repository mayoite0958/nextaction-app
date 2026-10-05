// Phone-connection constants and helpers shared by Settings, onboarding and /connect-phone.

/** iCloud link to the "Save to Next Action" iPhone shortcut. PLACEHOLDER — replace with the real link. */
export const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/REPLACE-WITH-YOUR-SHORTCUT";

/** Where the desktop bookmark and Android share send saved links. PLACEHOLDER following the n8n pattern. */
export const CAPTURE_URL = "https://vidhikaindustries.app.n8n.cloud/webhook/capture";

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

/** Bookmarklet that sends the current page to the capture address with the key. */
export function bookmarklet(key: string) {
  const js = `(function(){fetch(${JSON.stringify(CAPTURE_URL)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:${JSON.stringify(key)},url:location.href,title:document.title,source:'desktop'})}).then(function(){alert('Saved to Next Action')}).catch(function(){alert('Could not save to Next Action')})})()`;
  return `javascript:${encodeURIComponent(js)}`;
}

export function newKey() {
  return crypto.randomUUID().replace(/-/g, "");
}
