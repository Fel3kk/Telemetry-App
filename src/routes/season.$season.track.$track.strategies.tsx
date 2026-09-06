import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShellHeader, ShellPage } from "@/components/f1/ShellHeader";
import { titleCaseTrack, trackSlug } from "@/lib/f1-shell";
import {
  COMPOUNDS,
  COMPOUND_COLOR,
  COMPOUND_SHORT,
  compoundText,
  createStrategy,
  deleteStrategy,
  listStrategies,
  relayStints,
  stintLaps,
  totalLaps,
  trackLapLimit,
  updateStrategy,
  type Strategy,
  type StrategyStint,
} from "@/lib/strategies";

export const Route = createFileRoute("/season/$season/track/$track/strategies")({
  component: StrategiesPage,
});

type Draft = {
  id: string | null;
  name: string;
  notes: string;
  source: "race" | "custom";
  stints: StrategyStint[];
};

function emptyDraft(): Draft {
  return {
    id: null,
    name: "",
    notes: "",
    source: "custom",
    stints: relayStints([
      { compound: "Medium", start_lap: 1, end_lap: 20 },
      { compound: "Hard", start_lap: 1, end_lap: 30 },
    ]),
  };
}

function StrategiesPage() {
  const { season, track } = Route.useParams();
  const { cat } = Route.useSearch();
  const trackKey = trackSlug(track);
  const display = titleCaseTrack(track);

  const [rows, setRows] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    listStrategies(trackKey)
      .then((r) => {
        setRows(r);
        setErr(null);
      })
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [trackKey]);

  useEffect(reload, [reload]);

  const draftTotal = useMemo(() => (draft ? totalLaps(draft.stints) : 0), [draft]);
  const lapLimit = useMemo(() => trackLapLimit(trackKey), [trackKey]);
  const overLimit = lapLimit != null && draftTotal > lapLimit;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      if (lapLimit != null && totalLaps(draft.stints) > lapLimit) {
        setErr(`This strategy is longer than the race: ${totalLaps(draft.stints)} laps vs ${lapLimit} at ${display}.`);
        return;
      }
      const stints = relayStints(draft.stints);
      const name = draft.name.trim() || autoName(stints);
      if (draft.id) {
        await updateStrategy(draft.id, { name, notes: draft.notes, stints });
      } else {
        await createStrategy({
          track_key: trackKey,
          season: Number(season) || null,
          name,
          notes: draft.notes,
          source: "custom",
          stints,
        });
      }
      setDraft(null);
      reload();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ShellHeader
        crumbs={[
          { label: `Season ${season}`, to: "/" },
          {
            label: cat ? `${display} · ${cat}` : display,
            to: "/season/$season/track/$track",
            params: { season, track },
            search: { cat },
          },
          { label: "Possible Strategies" },
        ]}
      />
      <ShellPage>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Possible Strategies</h1>
            <p className="text-sm text-white/50">
              Saved for {display} — shared across every season, career slot and session of this
              track{lapLimit != null ? ` · race distance ${lapLimit} laps` : ""}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDraft(emptyDraft())}
              className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-400"
            >
              + New strategy
            </button>
            <Link
              to="/season/$season/track/$track"
              params={{ season, track }}
              search={{ cat }}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
            >
              ← Back to {display}
            </Link>
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {err}
          </div>
        )}

        {draft && (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={autoName(draft.stints)}
                className="min-w-[200px] flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold outline-none focus:border-red-500/60"
              />
              <span
                className={`text-xs uppercase tracking-widest ${overLimit ? "text-red-400" : "text-white/50"}`}
              >
                {lapLimit != null ? `${draftTotal} / ${lapLimit} laps` : `${draftTotal} laps total`}
                {overLimit ? " — over race distance" : ""}
              </span>
            </div>

            <StrategyBar stints={relayStints(draft.stints)} />

            <div className="mt-3 space-y-2">
              {draft.stints.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-14 text-[11px] uppercase tracking-widest text-white/40">
                    Stint {i + 1}
                  </span>
                  <select
                    value={s.compound}
                    onChange={(e) => {
                      const next = [...draft.stints];
                      next[i] = { ...s, compound: e.target.value };
                      setDraft({ ...draft, stints: next });
                    }}
                    className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-red-500/60"
                  >
                    {COMPOUNDS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={stintLaps(s)}
                    onChange={(e) => {
                      const len = Math.max(1, Number(e.target.value) || 1);
                      const next = [...draft.stints];
                      next[i] = { ...s, start_lap: 1, end_lap: len };
                      setDraft({ ...draft, stints: relayStints(next) });
                    }}
                    className="w-20 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-red-500/60"
                  />
                  <span className="text-xs text-white/40">laps</span>
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        stints: relayStints(draft.stints.filter((_, j) => j !== i)),
                      })
                    }
                    disabled={draft.stints.length <= 1}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-red-500/60 hover:text-white disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    stints: relayStints([
                      ...draft.stints,
                      { compound: "Soft", start_lap: 1, end_lap: 15 },
                    ]),
                  })
                }
                className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold hover:border-red-500/60"
              >
                + Add stint
              </button>
            </div>

            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Notes — pit windows, fuel mode, weather…"
              className="mt-3 min-h-[80px] w-full resize-y rounded-md border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-red-500/60"
            />

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving || overLimit}
                className="rounded-md bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : draft.id ? "Save changes" : "Create strategy"}
              </button>
              <button
                onClick={() => setDraft(null)}
                className="rounded-md border border-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <div className="text-white/50">Loading strategies…</div>}
        {!loading && rows.length === 0 && !draft && (
          <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-white/50">
            No strategies saved for {display} yet. Create one here, or use “Add as tyre strategy”
            under the stints in Race Story.
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((s) => (
            <div key={s.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold">{s.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
                    <span
                      className="rounded-sm px-1.5 py-0.5 font-black text-black"
                      style={{ background: s.source === "race" ? "#f59e0b" : "#64748b" }}
                    >
                      {s.source === "race" ? "From race" : "Custom"}
                    </span>
                    {s.season ? <span>S{s.season}</span> : null}
                    <span>{totalLaps(s.stints)} laps</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    title="Edit"
                    onClick={() =>
                      setDraft({
                        id: s.id,
                        name: s.name,
                        notes: s.notes,
                        source: s.source,
                        stints: s.stints.length ? s.stints : emptyDraft().stints,
                      })
                    }
                    className="rounded-md border border-white/10 px-2 py-1 text-xs hover:border-red-500/60"
                  >
                    ✏️
                  </button>
                  <button
                    title="Duplicate"
                    onClick={() =>
                      setDraft({
                        id: null,
                        name: `${s.name} (copy)`,
                        notes: s.notes,
                        source: "custom",
                        stints: s.stints,
                      })
                    }
                    className="rounded-md border border-white/10 px-2 py-1 text-xs hover:border-red-500/60"
                  >
                    ⧉
                  </button>
                  <button
                    title="Delete"
                    onClick={async () => {
                      if (!confirm(`Delete strategy “${s.name}”?`)) return;
                      await deleteStrategy(s.id);
                      reload();
                    }}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs hover:border-red-500/60"
                  >
                    ×
                  </button>
                </div>
              </div>
              <StrategyBar stints={s.stints} />
              {s.notes?.trim() && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-white/60">{s.notes}</p>
              )}
            </div>
          ))}
        </div>
      </ShellPage>
    </>
  );
}

function StrategyBar({ stints }: { stints: StrategyStint[] }) {
  const total = totalLaps(stints) || 1;
  return (
    <div className="flex h-9 w-full overflow-hidden rounded-md">
      {stints.map((s, i) => {
        const pct = (stintLaps(s) / total) * 100;
        const color = COMPOUND_COLOR[s.compound] ?? "#888";
        return (
          <div
            key={i}
            title={`${s.compound} · L${s.start_lap}–L${s.end_lap}`}
            className="flex items-center justify-center gap-1 text-[11px] font-black"
            style={{ flexBasis: `${pct}%`, background: color, color: compoundText(s.compound) }}
          >
            <span>{COMPOUND_SHORT[s.compound] ?? "?"}</span>
            <span className="hidden opacity-70 sm:inline">
              {s.start_lap}–{s.end_lap}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function autoName(stints: StrategyStint[]) {
  const seq = stints.map((s) => COMPOUND_SHORT[s.compound] ?? "?").join("-");
  const stops = Math.max(0, stints.length - 1);
  return `${seq} (${stops}-stop)`;
}
