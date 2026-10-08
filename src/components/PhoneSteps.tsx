import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_ORIGIN, SHORTCUT_ICLOUD_URL, chromeIntentUrl, shortcutRunUrl, type Device } from "@/lib/phone";
import { InstallAndroid } from "@/components/InstallAndroid";

/** iPhone / Android / in-app browser instructions. Shared by Settings, onboarding and /connect-phone. */
export function PhoneSteps({ device, captureKey }: { device: Device; captureKey: string }) {
  if (device === "inapp") {
    const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
    const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/connect-phone";
    const liveUrl = `${APP_ORIGIN}${path}`;
    return (
      <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
        <p className="font-medium">
          {isAndroid ? "To install Next Action, open this page in Chrome" : "Open this page in Safari or Chrome first."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isAndroid && (
            <Button asChild>
              <a href={chromeIntentUrl(path)}>Open in Chrome</a>
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() =>
              navigator.clipboard
                ?.writeText(liveUrl)
                .then(() => toast.success("Link copied — paste it into Chrome."))
                .catch(() => toast(liveUrl))
            }
          >
            Copy link
          </Button>
        </div>
      </div>
    );
  }
  if (device === "iphone") {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <a href={SHORTCUT_ICLOUD_URL}>① Add the shortcut</a>
          </Button>
          <Button asChild variant="secondary">
            <a href={shortcutRunUrl(captureKey)}>② Connect my iPhone</a>
          </Button>
        </div>
        <p className="text-muted-foreground">Tap ①, tap Add Shortcut, come back, then tap ②.</p>
      </div>
    );
  }
  if (device === "android") return <InstallAndroid />;
  return null;
}
