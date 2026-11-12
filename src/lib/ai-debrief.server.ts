// Server-only: talks to Google AI Studio (Gemini) with the project's secret key.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./f1-shell";

// Tried in order; demand spikes return 503, so fall through to the next one.
const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];

/** Confirms the bearer token belongs to a signed-in user of the app. */
export async function verifyUser(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json().catch(() => null)) as { id?: string } | null;
  return user?.id ?? null;
}

export type GeminiResult = { ok: true; json: unknown; model: string } | { ok: false; error: string };

/** Gemini first (own key); if it is missing, rejected or out of quota, use the built-in Lovable AI. */
export async function callGemini(
  prompt: string,
  schema: object,
  system: string,
  image?: { mimeType: string; data: string },
): Promise<GeminiResult> {
  const first = await callOwnGemini(prompt, schema, system, image);
  if (first.ok || !process.env["LOVABLE_API_KEY"]) return first;
  const fallback = await callLovableAI(prompt, schema, system, image);
  return fallback.ok ? fallback : first;
}

async function callLovableAI(
  prompt: string,
  schema: object,
  system: string,
  image?: { mimeType: string; data: string },
): Promise<GeminiResult> {
  const model = "openai/gpt-6-astra";
  try {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model,
        instructions: `${system}\n\nReply with only a JSON object matching this schema:\n${JSON.stringify(schema)}`,
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          ...(image ? [{ type: "input_image" as const, image_url: `data:${image.mimeType};base64,${image.data}`, detail: "auto" as const }] : []),
        ] }],
      });
      const text = (res.output ?? []).flatMap((o: any) => o.type === "message" ? o.content : [])
        .map((c: any) => c.type === "output_text" ? c.text : "").join("")
        .replace(/^```(?:json)?\s*|\s*```$/g, "");
      return { ok: true, json: JSON.parse(text), model };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("Lovable AI error", e.code, e.httpStatus, e.ids);
        if (e.httpStatus === 402) return { ok: false, error: "AI credits are used up for this workspace." };
        if (e.httpStatus === 429) return { ok: false, error: "The AI engineer is busy. Try again in a minute." };
      } else console.error("Lovable AI failure", e);
      return { ok: false, error: "The AI engineer is unavailable right now. Try again in a minute." };
    }
  } catch (e) {
    console.error("Lovable AI import failure", e);
    return { ok: false, error: "The AI engineer is unavailable right now. Try again in a minute." };
  }
}

async function callOwnGemini(
  prompt: string,
  schema: object,
  system: string,
  image?: { mimeType: string; data: string },
): Promise<GeminiResult> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) return { ok: false, error: "The Google AI key isn't set up on the server." };
  let lastError = "The AI engineer is unavailable right now. Try again in a minute.";
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [
            { text: prompt },
            ...(image ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }] : []),
          ] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
        }),
      });
    } catch (e) {
      console.error("Gemini network error", model, e);
      continue;
    }
    if (res.status === 503 || res.status === 500 || res.status === 404) {
      console.warn("Gemini model unavailable", model, res.status);
      continue;
    }
    if (res.status === 429) {
      lastError = "Your free Google AI limit is used up for now. Try again later.";
      continue;
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      console.error("Gemini rejected request", model, res.status, (await res.text()).slice(0, 500));
      return { ok: false, error: "Google rejected the AI key. It may have been deleted or restricted — replace it and try again." };
    }
    if (!res.ok) {
      console.error("Gemini error", model, res.status, (await res.text()).slice(0, 500));
      continue;
    }
    const body = (await res.json().catch(() => null)) as any;
    const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
    if (!text) continue;
    try {
      return { ok: true, json: JSON.parse(text), model };
    } catch {
      console.error("Gemini returned non-JSON", model, text.slice(0, 300));
      continue;
    }
  }
  return { ok: false, error: lastError };
}
