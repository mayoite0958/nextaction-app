import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CAPTURE_URL, KEY_STORAGE } from "@/lib/phone";

// Android share target: the installed app opens this page with the shared link.
export const Route = createFileRoute("/share")({
  validateSearch: z.object({
    url: z.string().optional(),
    text: z.string().optional(),
    title: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Saving to Next Action" },
      { name: "description", content: "Saving a shared link to Next Action." },
      { property: "og:title", content: "Saving to Next Action" },
      { property: "og:description", content: "Saving a shared link to Next Action." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { url, text, title } = Route.useSearch();
  const [msg, setMsg] = useState("Saving…");
  useEffect(() => {
    const key = localStorage.getItem(KEY_STORAGE);
    if (!key) {
      setMsg("This phone isn't connected yet. Scan the code in Settings → Connect your phone first.");
      return;
    }
    const link = url || text?.match(/https?:\/\/\S+/)?.[0] || text || "";
    fetch(CAPTURE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, url: link, title: title ?? null, text: text ?? null, source: "android" }),
    })
      .then((r) => setMsg(r.ok ? "✅ Saved to Next Action" : "Couldn't save — please try again."))
      .catch(() => setMsg("Couldn't save — check your connection."));
  }, [url, text, title]);
  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <p className="text-lg">{msg}</p>
    </main>
  );
}
