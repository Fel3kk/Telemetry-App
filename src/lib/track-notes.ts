export type TrackNoteRow = { label: string; value: string };

export function parseTrackNotes(notes: string): TrackNoteRow[] {
  const rows: TrackNoteRow[] = [];
  const looseLines: string[] = [];
  let active: TrackNoteRow | null = null;

  for (const line of notes.split(/\r?\n/)) {
    const heading = line.match(/^\s*([^:\n]{1,48})\s*:\s*(.*)$/);
    if (heading) {
      if (active) rows.push(active);
      const label = heading[1]
        .trim()
        .split(/\s+/)
        .map((word) => {
          const normalized = word.toLowerCase();
          return normalized.length <= 3
            ? normalized.toUpperCase()
            : normalized[0].toUpperCase() + normalized.slice(1);
        })
        .join(" ");
      active = {
        label,
        value: heading[2].trim(),
      };
      continue;
    }

    if (!line.trim()) continue;
    if (active) {
      active.value += `${active.value ? "\n" : ""}${line.trim()}`;
    } else {
      looseLines.push(line.trim());
    }
  }

  if (active) rows.push(active);
  if (looseLines.length) rows.unshift({ label: "Notes", value: looseLines.join("\n") });
  return rows;
}
