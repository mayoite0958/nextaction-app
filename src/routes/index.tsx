import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Next Action — one clear move at a time" },
      {
        name: "description",
        content:
          "Next Action keeps your urgent work and your long-term work in balance, and tells you what to do next.",
      },
      { property: "og:title", content: "Next Action — one clear move at a time" },
      {
        property: "og:description",
        content:
          "Next Action keeps your urgent work and your long-term work in balance, and tells you what to do next.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
      <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Next Action</p>
      <h1 className="mt-6 text-5xl font-bold leading-tight sm:text-6xl">
        Stop choosing.
        <br />
        Start moving.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Next Action holds your projects, your deadlines and your split between urgent work and
        long-term work — then tells you the one thing worth doing right now.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/auth">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to="/auth" search={{}}>
            I already have an account
          </Link>
        </Button>
      </div>
    </main>
  );
}
