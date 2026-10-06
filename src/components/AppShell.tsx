import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Link to="/today" className="font-display text-base font-bold tracking-tight">
            Next<span className="text-primary">Action</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/today" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Today
            </Link>
            <Link to="/calendar" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Calendar
            </Link>
            <Link to="/resources" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              Resources
            </Link>
            <Link
              to="/settings"
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Settings
            </Link>
          </nav>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
