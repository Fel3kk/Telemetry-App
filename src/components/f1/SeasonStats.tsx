import { useEffect, useMemo, useState } from "react";
import { fetchSessions, loadCachedSessions, type Session } from "@/lib/f1-shell";
import { seasonDriverProfiles } from "@/lib/f1-stats";
import { DriverProfileDialog, type DriverProfile } from "@/components/f1/DriverProfileDialog";
import { DriverProfileTiles } from "@/components/f1/DriverProfileTiles";

export function SeasonStats({ season }: { season: number }) {
  const cached = typeof window !== "undefined" ? loadCachedSessions() : null;
  const [sessions, setSessions] = useState<Session[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSessions()
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const drivers = useMemo(() => seasonDriverProfiles(sessions, season), [sessions, season]);

  return (
    <>
      <p className="mb-3 text-sm text-white/50">
        Season {season} · Select a driver to view their full season profile.
      </p>
      {loading && <p className="py-6 text-sm text-white/50">Loading season stats…</p>}
      {error && <p className="py-6 text-sm text-red-400">Failed to load season stats: {error}</p>}
      {!loading && !error && drivers.length === 0 && (
        <p className="py-6 text-sm text-white/50">No driver stats for this season yet.</p>
      )}
      {drivers.length > 0 && <DriverProfileTiles drivers={drivers} onSelect={setSelectedDriver} />}
      <DriverProfileDialog
        driver={selectedDriver}
        context={`Season ${season}`}
        onClose={() => setSelectedDriver(null)}
      />
    </>
  );
}
