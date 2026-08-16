import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CAREER_SLOTS,
  getActiveCareer,
  setActiveCareer,
  getCareerNames,
  setCareerNames,
  type CareerSlot,
} from "@/lib/career";
import { fetchCareerCounts, clearSessionsCache } from "@/lib/f1-shell";
import { ShellPage } from "@/components/f1/ShellHeader";
import { supabase, displayNameFromSession } from "@/lib/supabase";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Choose a career · F1 Telemetry Analyzer" },
      { name: "description", content: "Pick a driver career or my-team career slot to load its telemetry sessions." },
      { property: "og:title", content: "Choose a career · F1 Telemetry Analyzer" },
      { property: "og:description", content: "Pick a driver career or my-team career slot to load its telemetry sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CareersPage,
});

function CareersPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setActive(getActiveCareer());
    setNames(getCareerNames());
    fetchCareerCounts().then(setCounts).catch(() => {});
    supabase.auth.getSession().then(({ data }) => setName(displayNameFromSession(data.session)));
    supabase
      .from("career_slot_names")
      .select("slot_id,name")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((r: any) => {
          if (r?.slot_id && r?.name) map[r.slot_id] = r.name;
        });
        setNames(map);
        setCareerNames(map);
      });
  }, []);

  async function saveName(slot: CareerSlot, value: string) {
    const clean = value.trim().slice(0, 40);
    const next = { ...names };
    if (clean) next[slot.id] = clean;
    else delete next[slot.id];
    setNames(next);
    setCareerNames(next);
    setEditing(null);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;
    if (clean) {
      await supabase
        .from("career_slot_names")
        .upsert({ user_id: uid, slot_id: slot.id, name: clean }, { onConflict: "user_id,slot_id" });
    } else {
      await supabase.from("career_slot_names").delete().eq("user_id", uid).eq("slot_id", slot.id);
    }
  }

  function choose(slot: CareerSlot) {
    setActiveCareer(slot.id);
    clearSessionsCache();
    navigate({ to: "/" });
  }

  const groups: { type: "driver" | "team"; title: string; blurb: string; icon: string }[] = [
    { type: "driver", title: "Driver career", blurb: "You race for an existing team", icon: "🏎️" },
    { type: "team", title: "My Team career", blurb: "You run your own constructor", icon: "🏗️" },
  ];

  return (
    <ShellPage>
      <div className="mx-auto max-w-4xl py-6">
        <h1 className="text-3xl font-black">Choose a career</h1>
        <p className="mt-2 text-sm text-white/60">
          {name ? `Signed in as ${name}. ` : ""}Every upload is saved into the slot you pick here.
          Switch slots any time from the header.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <section key={g.type}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/60">
                {g.icon} {g.title}
                <span className="ml-2 block font-normal normal-case tracking-normal text-white/35">{g.blurb}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {CAREER_SLOTS.filter((s) => s.type === g.type).map((s) => {
                  const n = counts[s.id] ?? 0;
                  const isActive = active === s.id;
                  if (editing === s.id) {
                    return (
                      <form
                        key={s.id}
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveName(s, draft);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-red-500/60 bg-white/[0.04] p-4"
                      >
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder={`${g.type === "driver" ? "Driver" : "My Team"} ${s.index}`}
                          maxLength={40}
                          className="min-w-0 flex-1 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-red-500"
                        />
                        <button
                          type="submit"
                          className="rounded bg-red-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/60"
                        >
                          Cancel
                        </button>
                      </form>
                    );
                  }
                  return (
                    <button
                      key={s.id}
                      onClick={() => choose(s)}
                      className={
                        "flex items-center gap-3 rounded-lg border p-4 text-left transition hover:-translate-y-0.5 " +
                        (isActive
                          ? "border-red-500 bg-red-500/10"
                          : "border-white/10 bg-white/[0.03] hover:border-red-500/60")
                      }
                    >
                      <span className="text-xs font-black uppercase tracking-widest text-white/50">
                        Slot {s.index}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-lg font-bold">
                          {names[s.id] || `${g.type === "driver" ? "Driver" : "My Team"} ${s.index}`}
                        </span>
                        <span className="text-xs text-white/55">
                          {n > 0 ? `${n} session${n === 1 ? "" : "s"}` : "Empty — upload to start"}
                        </span>
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        {isActive && (
                          <span className="rounded-sm bg-red-500 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                            Active
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraft(names[s.id] ?? "");
                            setEditing(s.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setDraft(names[s.id] ?? "");
                              setEditing(s.id);
                            }
                          }}
                          className="rounded border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:border-red-500/60 hover:text-white"
                        >
                          Rename
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>


        {(counts["unassigned"] ?? 0) > 0 && (
          <p className="mt-8 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {counts["unassigned"]} session(s) are not assigned to a career slot yet. Run the
            migration in SETUP_CAREERS.sql to move them into My Team · Slot 1.
          </p>
        )}
      </div>
    </ShellPage>
  );
}
