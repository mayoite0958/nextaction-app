import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_ORIGIN } from "@/lib/phone";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Android install: real install button when Chrome offers it, otherwise clear manual steps. */
export function InstallAndroid() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [onProd, setOnProd] = useState(true);

  useEffect(() => {
    setOnProd(window.location.origin === APP_ORIGIN);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") toast.success("Installing Next Action…");
    setEvt(null);
  }

  if (installed) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">✅ Next Action is installed.</p>
        <p className="text-muted-foreground">Tap Share in any app (YouTube, Chrome…) → Next Action.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {!onProd ? (
        <Button asChild>
          <a href={`${APP_ORIGIN}/connect-phone`}>Open the app in Chrome to install</a>
        </Button>
      ) : evt ? (
        <Button onClick={install}>📲 Install Next Action</Button>
      ) : (
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open this page in <b>Chrome</b>.</li>
          <li>Tap the <b>⋮</b> menu (top right).</li>
          <li>Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.</li>
        </ol>
      )}
      <p className="text-muted-foreground">Then tap Share in any app → Next Action.</p>
    </div>
  );
}
