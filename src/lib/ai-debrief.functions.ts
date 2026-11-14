import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabase } from "./supabase";
import { callGemini, verifyUser } from "./ai-debrief.server";

export type Debrief = {
  grade: string;
  headline: string;
  radio: string;
  summary: string;
  consistency: string;
  tyres: string;
  pace: string;
  strengths: string[];
  improvements: { area: string; detail: string }[];
};

// Sends the signed-in user's token so the server can confirm who is asking.
const attachToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } =
    typeof window === "undefined" ? { data: { session: null } } : await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

const SYSTEM = `You are an experienced Formula 1 race engineer debriefing a driver after an F1 26 video-game session.
Treat the supplied session facts as the only source of truth. Never invent a lap, rival, setup, event, cause or statistic. Times are seconds.
Make the debrief specific and useful: anchor each observation to an exact lap, stint, position, time, gap or wear value. Prefer a clear diagnosis and a practical next action over generic praise. Keep each text field to 1–3 short sentences.
For pace, use lap_pace.best_clean_lap, slowest_clean_lap, median_clean_lap_s and best_sectors. The sector figures are the driver's personal bests, not sector gaps to rivals.
For race comparisons, use race_comparison and nearby_rivals. official_best_lap_rank compares the player's and classified drivers' official best laps; a positive gap_to_fastest_s means the player's lap is slower. In nearby_drivers, a positive gap_to_driver_best_s means the player is slower; rival_time_minus_driver_s is only available when both drivers completed the same number of laps. clean_lap_field_pace is the player's lap-time delta against the field median on clean laps; positive is slower, negative is faster. Do not compare total race times across different lap counts.
For tyre strategy, use each stint's lap range, compound, clean_laps, clean_median_lap_s, best_clean_lap, clean_pace_change_s and wear values. A positive clean_pace_change_s means the later clean-lap half was slower; it does not by itself prove tyre degradation or its cause. pit_stops is the authoritative stop count; pit_laps, in/out laps and stints are evidence/details, not extra stops.
Use position_gained and position_history to describe race progress when supplied. Separate observed facts from interpretation, and never attribute position or pace changes to a cause not recorded in the data.
The consistency score measures clean-lap spread around each stint trend after excluding pit, out, neutralization and other flagged laps; fuel burn and steady tyre wear are removed. 90+ is elite, 75+ is good, and 55+ is average. Do not discuss consistency when its score is null.
Base the grade on the session result and evidence available. State when a comparison is unavailable; do not fill gaps with assumptions or generic advice.`;

const DEBRIEF_SCHEMA = {
  type: "OBJECT",
  properties: {
    grade: { type: "STRING", description: "Overall driver grade, A+ to F" },
    headline: { type: "STRING", description: "One-line verdict, max 12 words" },
    radio: { type: "STRING", description: "Short team-radio style message to the driver" },
    summary: { type: "STRING" },
    consistency: {
      type: "STRING",
      description: "Interpret the score and cite a supported lap or stint trend",
    },
    tyres: {
      type: "STRING",
      description:
        "Compare stint ranges, clean pace, wear change and verified stop count; avoid unsupported tyre-cause claims",
    },
    pace: {
      type: "STRING",
      description:
        "Use lap-numbered clean pace, sector bests and official/field comparisons when available",
    },
    strengths: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Up to 3 evidence-based things done well; use fewer if evidence is limited",
    },
    improvements: {
      type: "ARRAY",
      description:
        "Up to 3 specific, actionable notes supported by the session data; return fewer when evidence is limited",
      items: {
        type: "OBJECT",
        properties: { area: { type: "STRING" }, detail: { type: "STRING" } },
        required: ["area", "detail"],
      },
    },
  },
  required: [
    "grade",
    "headline",
    "radio",
    "summary",
    "consistency",
    "tyres",
    "pace",
    "strengths",
    "improvements",
  ],
};

const ANSWER_SCHEMA = {
  type: "OBJECT",
  properties: { answer: { type: "STRING" } },
  required: ["answer"],
};

const asObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const Input = z.object({
  facts: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= 40_000, "Session data too large"),
  question: z.string().trim().min(1).max(500).optional(),
  history: z
    .array(z.object({ q: z.string().max(500), a: z.string().max(2000) }))
    .max(6)
    .optional(),
});

export const generateDebrief = createServerFn({ method: "POST" })
  .middleware([attachToken])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; debrief?: Debrief; answer?: string; model: string } | { ok: false; error: string }
    > => {
      const userId = await verifyUser(getRequestHeader("authorization"));
      if (!userId) return { ok: false, error: "Sign in to use the AI race engineer." };

      const facts = JSON.stringify(data.facts);
      if (data.question) {
        const past = (data.history ?? [])
          .map((h) => `Driver: ${h.q}\nEngineer: ${h.a}`)
          .join("\n\n");
        const prompt = `Session data:\n${facts}\n\n${past ? `Earlier in this conversation:\n${past}\n\n` : ""}Driver asks: ${data.question}\n\nAnswer in 2-5 sentences using only the data.`;
        const r = await callGemini(prompt, ANSWER_SCHEMA, SYSTEM);
        if (!r.ok) return r;
        const answer = String(asObject(r.json)?.answer ?? "").slice(0, 2000);
        return answer
          ? { ok: true, answer, model: r.model }
          : { ok: false, error: "The engineer didn't answer. Try asking again." };
      }

      const r = await callGemini(`Debrief this session:\n${facts}`, DEBRIEF_SCHEMA, SYSTEM);
      if (!r.ok) return r;
      const j = asObject(r.json) ?? {};
      const str = (v: unknown) => String(v ?? "").slice(0, 1200);
      const debrief: Debrief = {
        grade: str(j?.grade).slice(0, 3),
        headline: str(j?.headline),
        radio: str(j?.radio),
        summary: str(j?.summary),
        consistency: str(j?.consistency),
        tyres: str(j?.tyres),
        pace: str(j?.pace),
        strengths: Array.isArray(j?.strengths) ? j.strengths.slice(0, 4).map(str) : [],
        improvements: Array.isArray(j?.improvements)
          ? j.improvements.slice(0, 5).map((value) => {
              const improvement = asObject(value);
              return {
                area: str(improvement?.area),
                detail: str(improvement?.detail),
              };
            })
          : [],
      };
      return { ok: true, debrief, model: r.model };
    },
  );
