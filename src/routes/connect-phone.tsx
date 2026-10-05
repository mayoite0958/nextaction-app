import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PhoneSteps } from "@/components/PhoneSteps";
import { detectDevice, KEY_STORAGE, type Device } from "@/lib/phone";

export const Route = createFileRoute("/connect-phone")({
  validateSearch: z.object({ k: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Connect your phone — Next Action" },
      { name: "description", content: "Link your phone so you can save links to Next Action from anywhere." },
      { property: "og:title", content: "Connect your phone — Next Action" },
      { property: "og:description", content: "Link your phone so you can save links to Next Action from anywhere." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectPhonePage,
});

function ConnectPhonePage() {
  const { k } = Route.useSearch();
  const [device, setDevice] = useState<Device | null>(null);
  useEffect(() => {
    setDevice(detectDevice(navigator.userAgent));
    if (k) localStorage.setItem(KEY_STORAGE, k);
  }, [k]);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="font-display text-base font-bold">
        Next<span className="text-primary">Action</span>
      </p>
      <h1 className="mt-6 text-2xl font-bold">Connect your phone</h1>
      <div className="panel mt-6 p-5">
        {!k ? (
          <p className="text-sm text-muted-foreground">
            This link is missing its key. Open Settings → Connect your phone on your computer and scan the code again.
          </p>
        ) : !device ? null : device === "desktop" ? (
          <p className="text-sm text-muted-foreground">Open this page on your phone to connect it.</p>
        ) : (
          <PhoneSteps device={device} captureKey={k} />
        )}
      </div>
    </main>
  );
}
