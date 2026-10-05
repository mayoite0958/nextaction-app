import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CAPTURE_URL } from "@/lib/phone";

// Forwards saves from /share to n8n so the browser never hits cross-site blocking.
const Body = z.object({
  key: z.string().min(8).max(200),
  url: z.string().min(1).max(4000),
  note: z.string().min(1).max(4000),
  title: z.string().max(1000).default(""),
  source: z.enum(["android", "desktop"]),
});

export const Route = createFileRoute("/api/public/share-capture")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request", { status: 400 });
        const r = await fetch(CAPTURE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const text = (await r.text()).slice(0, 500);
        return new Response(text, { status: r.ok ? 200 : 502, headers: { "Content-Type": "text/plain" } });
      },
    },
  },
});
