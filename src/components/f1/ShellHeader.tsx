import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase, displayNameFromSession } from "@/lib/supabase";

export function titleCase(name: string) {
  return (name || "")
    .split(/([\s_-]+)/)
    .map((p) => (/^[\s_-]+$/.test(p) ? " " : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("")
    .trim();
}

export function ShellHeader({ crumbs }: { crumbs: { label: string; to?: any; params?: any; search?: any }[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-black tracking-tight text-white hover:text-red-400">
          <span>🏎️</span>
          <span>F1 Telemetry</span>
        </Link>
        <nav className="ml-4 flex items-center gap-2 text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-white/30">/</span>}
              {c.to ? (
                <Link to={c.to} params={c.params as any} search={c.search as any} className="text-white/70 hover:text-white">
                  {c.label}
                </Link>
              ) : (
                <span className="font-semibold text-white">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/"
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            Home
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
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
      <span className="hidden text-xs font-semibold uppercase tracking-widest text-white/60 sm:inline">{name}</span>
      <button
        onClick={signOut}
        className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
      >
        Sign out
      </button>
    </div>
  );
}

export function ShellPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-6">{children}</div>
    </div>
  );
}
