import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { COACHING_TONES, ROLE_TEMPLATES, TIMEZONES } from "@/lib/nextaction";
import { ConnectPhone } from "@/components/ConnectPhone";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up Next Action" },
      { name: "description", content: "Tell Next Action how you work so it can prioritise for you." },
      { property: "og:title", content: "Set up Next Action" },
      {
        property: "og:description",
        content: "Tell Next Action how you work so it can prioritise for you.",
      },
    ],
  }),
  component: Onboarding,
});

type DraftProject = { name: string; goal: string; deadline: string; bucket: string; value: number };

const emptyProject = (): DraftProject => ({
  name: "",
  goal: "",
  deadline: "",
  bucket: "urgent",
  value: 3,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);

  const [consent, setConsent] = useState(false);
  const [template, setTemplate] = useState("job_seeker");
  const [displayName, setDisplayName] = useState("");
  const [urgentLabel, setUrgentLabel] = useState(ROLE_TEMPLATES[0]!.urgentLabel);
  const [longtermLabel, setLongtermLabel] = useState(ROLE_TEMPLATES[0]!.longtermLabel);
  const [urgentShare, setUrgentShare] = useState(ROLE_TEMPLATES[0]!.urgentShare);
  const [valueLabel, setValueLabel] = useState(ROLE_TEMPLATES[0]!.valueLabel);
  const [priorityNotes, setPriorityNotes] = useState("");
  const [tone, setTone] = useState("direct");
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [projects, setProjects] = useState<DraftProject[]>([
    emptyProject(),
    emptyProject(),
    emptyProject(),
  ]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("user_settings").select("user_id").maybeSingle();
      if (!active) return;
      if (data) navigate({ to: "/today", replace: true });
      else setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  function pickTemplate(id: string) {
    setTemplate(id);
    const t = ROLE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setUrgentLabel(t.urgentLabel);
    setLongtermLabel(t.longtermLabel);
    setUrgentShare(t.urgentShare);
    setValueLabel(t.valueLabel);
  }

  async function finish() {
    const filled = projects.filter((p) => p.name.trim());
    if (filled.length < 3) {
      toast.error("Add at least 3 projects to get started.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You are signed out.");

      const { error: settingsError } = await supabase.from("user_settings").insert({
        user_id: uid,
        display_name: displayName.trim() || null,
        role_template: template,
        timezone,
        urgent_share: urgentShare,
        bucket_urgent_label: urgentLabel,
        bucket_longterm_label: longtermLabel,
        value_label: valueLabel,
        priority_notes: priorityNotes.trim() || null,
        coaching_tone: tone,
        reply_language: language,
        consent_given_at: new Date().toISOString(),
      });
      if (settingsError) throw settingsError;

      const { error: projectsError } = await supabase.from("projects").insert(
        filled.map((p) => ({
          user_id: uid,
          name: p.name.trim(),
          goal: p.goal.trim() || null,
          deadline: p.deadline || null,
          bucket: p.bucket,
          value_score: p.value,
          status: "active",
        })),
      );
      if (projectsError) throw projectsError;

      toast.success("You're set up.");
      setStep(5);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your setup");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
        Step {step} of 5
      </p>
      <div className="mt-3 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <section className="mt-8">
          <h1 className="text-3xl font-bold">Before we start</h1>
          <p className="mt-3 text-muted-foreground">
            Next Action stores the projects, notes and work sessions you enter so it can recommend
            what to do next. Only you can see them, and you can delete everything at any time from
            Settings.
          </p>
          <label className="panel mt-6 flex cursor-pointer items-start gap-3 p-5">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <span className="text-sm">
              I agree to Next Action storing my projects and work data to give me
              recommendations.
            </span>
          </label>
          <Button className="mt-6" disabled={!consent} onClick={() => setStep(2)}>
            Continue
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="mt-8">
          <h1 className="text-3xl font-bold">What best describes you?</h1>
          <div className="mt-6 space-y-3">
            {ROLE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTemplate(t.id)}
                className={`panel w-full p-5 text-left transition-colors ${
                  template === t.id ? "ring-2 ring-primary" : "hover:bg-secondary/60"
                }`}
              >
                <p className="font-display font-semibold">{t.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.urgentLabel} · {t.longtermLabel} — {t.urgentShare}/{100 - t.urgentShare},
                  optimising for {t.valueLabel}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-8">
          <h1 className="text-3xl font-bold">Make it yours</h1>
          <div className="panel mt-6 space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ul">Urgent category name</Label>
                <Input id="ul" value={urgentLabel} onChange={(e) => setUrgentLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ll">Long-term category name</Label>
                <Input
                  id="ll"
                  value={longtermLabel}
                  onChange={(e) => setLongtermLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>
                Split: {urgentShare}% {urgentLabel} / {100 - urgentShare}% {longtermLabel}
              </Label>
              <Slider
                value={[urgentShare]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => setUrgentShare(v[0] ?? 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vl">What are you optimising for?</Label>
              <Input id="vl" value={valueLabel} onChange={(e) => setValueLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pn">Priority notes</Label>
              <Textarea
                id="pn"
                rows={3}
                placeholder="Anything Next Action should always keep in mind"
                value={priorityNotes}
                onChange={(e) => setPriorityNotes(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Coaching tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COACHING_TONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lang">Reply language</Label>
                <Input id="lang" value={language} onChange={(e) => setLanguage(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)}>Continue</Button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="mt-8">
          <h1 className="text-3xl font-bold">Add 3–5 projects</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These are the things you're actually trying to move forward.
          </p>
          <div className="mt-6 space-y-4">
            {projects.map((p, i) => (
              <div key={i} className="panel space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Project name</Label>
                    <Input
                      value={p.name}
                      onChange={(e) =>
                        setProjects((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deadline</Label>
                    <Input
                      type="date"
                      value={p.deadline}
                      onChange={(e) =>
                        setProjects((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, deadline: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Goal</Label>
                  <Input
                    value={p.goal}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, goal: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={p.bucket}
                      onValueChange={(v) =>
                        setProjects((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, bucket: v } : x)),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">{urgentLabel}</SelectItem>
                        <SelectItem value="long_term">{longtermLabel}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value to you: {p.value}/5</Label>
                    <Slider
                      value={[p.value]}
                      min={1}
                      max={5}
                      step={1}
                      onValueChange={(v) =>
                        setProjects((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, value: v[0] ?? 3 } : x)),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {projects.length < 5 && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setProjects((p) => [...p, emptyProject()])}
            >
              Add another project
            </Button>
          )}
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button onClick={finish} disabled={saving}>
              {saving ? "Saving…" : "Finish setup"}
            </Button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="mt-8">
          <h1 className="text-3xl font-bold">Connect your phone</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Save links to Next Action straight from your phone. You can also do this later in Settings.
          </p>
          <div className="panel mt-6 p-6">
            <ConnectPhone />
          </div>
          <Button className="mt-6" onClick={() => navigate({ to: "/today", replace: true })}>
            Go to Today
          </Button>
        </section>
      )}
    </main>
  );
}
