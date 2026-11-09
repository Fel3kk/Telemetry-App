import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateRacingLineDraft } from "@/lib/racing-line-ai.functions";
import { downloadRacingLineCollection, validRacingLine } from "@/lib/racing-lines";
import type { Point } from "@/lib/quali-simulation";

type Props = {
  track: string;
  mapUrl: string;
  line: Point[];
  onDraft: (points: Point[]) => void;
};

function base64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

function supportedImageType(value: string): value is "image/webp" | "image/png" | "image/jpeg" {
  return value === "image/webp" || value === "image/png" || value === "image/jpeg";
}

export function RacingLineActions({ track, mapUrl, line, onDraft }: Props) {
  const generate = useServerFn(generateRacingLineDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    setBusy(false);
    setMessage("");
    setError("");
  }, [track, mapUrl]);

  async function makeDraft() {
    const request = ++requestId.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(mapUrl);
      if (!response.ok) throw new Error(`Track map couldn't be loaded (${response.status}).`);
      const image = await response.blob();
      if (!supportedImageType(image.type)) {
        throw new Error("The track map must be a WebP, PNG, or JPEG image.");
      }
      if (image.size > 3_000_000) throw new Error("This track map is too large to send for AI tracing.");
      const result = await generate({
        data: {
          track,
          mimeType: image.type,
          imageBase64: base64(new Uint8Array(await image.arrayBuffer())),
        },
      });
      if (request !== requestId.current) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDraft(result.points);
      setMessage("AI draft ready. Check the route and start/finish position before exporting. The map image was sent to Google Gemini.");
    } catch (e) {
      if (request === requestId.current) setError(e instanceof Error ? e.message : "The AI draft couldn't be generated. Try again.");
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }

  function exportCollection() {
    if (!validRacingLine(line)) return;
    try {
      downloadRacingLineCollection(track, line);
      setError("");
      setMessage("Collection downloaded. Replace src/data/racing-lines.json and redeploy to publish it for everyone.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The racing-line collection couldn't be downloaded.");
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={busy} onClick={makeDraft}>
          <Sparkles />{busy ? "Tracing map…" : "AI draw line"}
        </Button>
        <Button variant="outline" className="flex-1" disabled={!validRacingLine(line)} onClick={exportCollection}>
          <Download />Download to publish
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        AI sends the track-map image to Google Gemini; it uses no lap times or movement telemetry. Review the draft before downloading the shared collection.
      </p>
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
