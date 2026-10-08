import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SHORTCUT_ICLOUD_URL, shortcutRunUrl, type Device } from "@/lib/phone";
import { InstallAndroid } from "@/components/InstallAndroid";

/** iPhone / Android / in-app browser instructions. Shared by Settings, onboarding and /connect-phone. */
export function PhoneSteps({ device, captureKey }: { device: Device; captureKey: string }) {
  if (device === "inapp") {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium">Open this page in Safari or Chrome first.</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            navigator.clipboard
              ?.writeText(window.location.href)
              .then(() => toast.success("Link copied — paste it into Safari or Chrome."))
              .catch(() => toast(window.location.href))
          }
        >
          Copy link
        </Button>
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
