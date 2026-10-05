import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { relativeTime } from "@/lib/nextaction";
import { bookmarklet, connectUrl, detectDevice, KEY_STORAGE, newKey, type Device } from "@/lib/phone";
import { PhoneSteps } from "@/components/PhoneSteps";

export function ConnectPhone() {
  const qc = useQueryClient();
  const [device, setDevice] = useState<Device | null>(null);
  const [captureKey, setCaptureKey] = useState<string | null>(null);

  useEffect(() => setDevice(detectDevice(navigator.userAgent)), []);

  async function saveKey(k: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("You are signed out.");
    const { error } = await supabase
      .from("user_settings")
      .update({ capture_key: k })
      .eq("user_id", u.user.id);
    if (error) throw error;
    setCaptureKey(k);
    localStorage.setItem(KEY_STORAGE, k);
  }

  // Load capture_key; generate one if empty.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_settings").select("capture_key").maybeSingle();
      const row = data;
      if (row?.capture_key) {
        setCaptureKey(row.capture_key);
        localStorage.setItem(KEY_STORAGE, row.capture_key);
      } else if (data) {
        await saveKey(newKey()).catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't create a key"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = useQuery({
    queryKey: ["phone_status"],
    refetchInterval: 10_000,
    queryFn: async () => {
      const [s, r] = await Promise.all([
        supabase.from("user_settings").select("last_capture_at").maybeSingle(),
        supabase
          .from("resources")
          .select("created_at")
          .in("source", ["android", "iphone"])
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      const last = s.data?.last_capture_at ?? null;
      const res = r.data?.[0]?.created_at ?? null;
      const times = [last, res].filter(Boolean) as string[];
      if (!times.length) return null;
      return times.sort().at(-1)!;
    },
  });

  async function reconnect() {
    if (!confirm("This disconnects your current iPhone shortcut. You'll need to tap Connect again.")) return;
    try {
      await saveKey(newKey());
      qc.invalidateQueries({ queryKey: ["phone_status"] });
      toast.success("New key created.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create a new key");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        {status.data ? `✅ Phone connected · last save ${relativeTime(status.data)}` : "Not connected yet"}
      </p>
      {!captureKey || !device ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : device === "desktop" ? (
        <div className="space-y-4">
          <div className="inline-block rounded-md bg-foreground p-3">
            <QRCodeSVG value={connectUrl(captureKey)} size={160} bgColor="transparent" fgColor="var(--background)" />
          </div>
          <p className="text-sm font-medium">Scan with your phone camera</p>
          <div className="space-y-1 text-sm">
            <a
              href={bookmarklet(captureKey)}
              onClick={(e) => e.preventDefault()}
              className="inline-block cursor-grab rounded-md border border-primary px-3 py-1.5 font-medium text-primary"
            >
              Save to Next Action
            </a>
            <p className="text-muted-foreground">Drag this button to your browser's bookmarks bar.</p>
          </div>
        </div>
      ) : (
        <PhoneSteps device={device} captureKey={captureKey} />
      )}
      <button type="button" onClick={reconnect} className="text-xs text-muted-foreground underline">
        Reconnect / new key
      </button>
    </div>
  );
}
