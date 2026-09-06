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
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <Link to="/careers" className="flex shrink-0 items-center gap-2 text-base font-black tracking-tight text-white hover:text-red-400 sm:text-lg">
          <span>🏎️</span>
          <span>F1 Telemetry</span>
        </Link>
        <div className="order-3 flex w-full min-w-0 items-center sm:order-none sm:ml-4 sm:w-auto">
          <nav className="flex min-w-0 items-center gap-2 overflow-x-auto text-xs sm:text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {crumbs.map((c, i) => (
              <span key={i} className="flex shrink-0 items-center gap-2">
                {i > 0 && <span className="text-white/30">/</span>}
                {c.to ? (
                  <Link to={c.to} params={c.params as any} search={c.search as any} className="whitespace-nowrap text-white/70 hover:text-white">
                    {c.label}
                  </Link>
                ) : (
                  <span className="whitespace-nowrap font-semibold text-white">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <CareerChip />
          <Link
            to="/"
            className="rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10 sm:px-3 sm:text-xs"
          >
            Home
          </Link>
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
      className="max-w-[120px] truncate rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-200 hover:bg-red-500/20 sm:max-w-none sm:px-3 sm:text-xs"
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
      <span className="hidden text-xs font-semibold uppercase tracking-widest text-white/60 sm:inline">{name}</span>
      <button
        onClick={signOut}
        className="rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10 sm:px-3 sm:text-xs"
      >
        Sign out
      </button>
    </div>
  );
}

export function ShellPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6">{children}</div>
    </div>
  );
}
