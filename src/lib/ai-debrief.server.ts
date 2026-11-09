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

export async function callGemini(prompt: string, schema: object, system: string): Promise<GeminiResult> {
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
          contents: [{ role: "user", parts: [{ text: prompt }] }],
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
