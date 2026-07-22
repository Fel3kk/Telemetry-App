import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, usernameToEmail, claimOrphanRows } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · F1 Telemetry Analyzer" },
      { name: "description", content: "Sign in to manage F1 telemetry uploads, race sessions, and season data." },
      { property: "og:title", content: "Sign in · F1 Telemetry Analyzer" },
      { property: "og:description", content: "Access your F1 telemetry uploads, race sessions, and season dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!username.trim() || !password) { setErr("Username and password required."); return; }
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      const email = usernameToEmail(username);
      if (!email || !email.includes("@")) {
        throw new Error("Enter a username or the exact email you created in Supabase.");
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("already") || msg.includes("registered")) {
            // Fall through: try to sign in with the same credentials.
            const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
            if (sErr) throw sErr;
          } else {
            if (msg.includes("email signups") || msg.includes("provider")) {
              throw new Error(
                "Email/password signups are disabled in Supabase. Turn Authentication → Providers → Email ON, or create the user manually, then sign in with the exact email or username.",
              );
            }
            throw error;
          }
        } else if (!data.session) {
          // No session returned → email confirmation is ON. Try sign-in anyway.
          const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
          if (sErr) {
            throw new Error(
              "Account created but email confirmation is required. In Supabase → Authentication → Providers → Email, turn OFF 'Confirm email', then sign in.",
            );
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("not confirmed")) {
            throw new Error(
              "Email not confirmed. In Supabase → Authentication → Users, open this user and confirm it, or turn OFF Authentication → Providers → Email → Confirm email.",
            );
          }
          if (msg.includes("invalid")) {
            throw new Error("Wrong username/email or password. If you created the account manually with an email, type that exact email; plain usernames sign in as username@f1.local.");
          }
          throw error;
        }
      }
      // Attach any orphan legacy rows to this account (only affects the first user).
      await claimOrphanRows();
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] px-4 text-white">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] p-6 shadow-xl">
        <h1 className="mb-1 text-2xl font-black tracking-tight">
          <span className="text-red-500">F1</span> Telemetry
        </h1>
        <p className="mb-6 text-sm text-white/50">
          {mode === "signin" ? "Sign in to your account" : "Create an account"}
        </p>

        <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/60">Username or email</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          className="mb-4 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-500"
        />

        <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/60">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="mb-4 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-500"
        />

        {err && <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="mb-3 w-full rounded-md bg-red-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => { setErr(null); setMode(mode === "signin" ? "signup" : "signin"); }}
          className="w-full text-center text-xs text-white/50 hover:text-white"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
