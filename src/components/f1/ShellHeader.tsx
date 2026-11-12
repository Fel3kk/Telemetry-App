import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase, displayNameFromSession } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Home, LogOut } from "lucide-react";

export function titleCase(name: string) {
  return (name || "")
    .split(/([\s_-]+)/)
    .map((p) => (/^[\s_-]+$/.test(p) ? " " : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("")
    .trim();
}

export function ShellHeader({ crumbs }: { crumbs: { label: string; to?: any; params?: any; search?: any }[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:flex sm:flex-wrap sm:gap-x-3 sm:px-4 sm:py-3">
        <Link to="/careers" className="flex min-w-0 items-center gap-2 text-sm font-black text-foreground hover:text-primary sm:shrink-0 sm:text-lg">
          <span>🏎️</span>
          <span className="truncate">F1 Telemetry</span>
        </Link>
        <div className="order-3 col-span-2 flex w-full min-w-0 items-center sm:order-none sm:ml-4 sm:w-auto">
          <nav className="flex min-w-0 items-center gap-2 overflow-x-auto text-xs sm:text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {crumbs.map((c, i) => (
              <span key={i} className="flex shrink-0 items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                {c.to ? (
                  <Link to={c.to} params={c.params as any} search={c.search as any} className="whitespace-nowrap text-muted-foreground hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span className="whitespace-nowrap font-semibold text-foreground">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <CareerChip />
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0"><Link to="/" aria-label="Home" title="Home"><Home /></Link></Button>
          <UserMenu />
        </div>
      </div>
    </header>

  );
}

function CareerChip() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    import("@/lib/career").then(({ activeCareerLabel }) => setLabel(activeCareerLabel()));
  }, []);
  return (
    <Link
      to="/careers"
      title="Switch career slot"
      className="max-w-[80px] truncate rounded-md border border-primary/40 bg-primary/10 px-2 py-3 text-[11px] font-bold text-foreground hover:bg-primary/20 sm:max-w-[160px] sm:px-3 sm:text-xs"
    >
      {label || "Career"}
    </Link>
  );
}


function UserMenu() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setName(displayNameFromSession(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setName(displayNameFromSession(s)));
    return () => sub.subscription.unsubscribe();
  }, []);
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }
  if (!name) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-28 truncate text-xs font-semibold uppercase text-muted-foreground sm:inline">{name}</span>
      <Button onClick={signOut} variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Sign out" title="Sign out"><LogOut /></Button>
    </div>
  );
}

export function ShellPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6">{children}</div>
    </div>
  );
}
