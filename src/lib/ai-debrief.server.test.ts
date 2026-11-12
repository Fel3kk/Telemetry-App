import { afterEach, describe, expect, it, vi } from "vitest";
import { callGemini } from "./ai-debrief.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Google AI key configuration", () => {
  it.each(["GOOGLE_AI_API_KEY", "GOOGLE_API_KEY"])(
    "accepts %s as a server-side key alias",
    async (keyName) => {
      vi.stubEnv("GEMINI_API_KEY", "");
      vi.stubEnv("GOOGLE_AI_API_KEY", "");
      vi.stubEnv("GOOGLE_API_KEY", "");
      vi.stubEnv(keyName, "test-google-key");

      const fetchMock = vi.fn<typeof fetch>(async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: '{"answer":"ok"}' }] } }],
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await callGemini("prompt", { type: "OBJECT" }, "system");

      expect(result.ok).toBe(true);
      const request = fetchMock.mock.calls[0]?.[1];
      expect(new Headers(request?.headers).get("x-goog-api-key")).toBe(
        "test-google-key",
      );
    },
  );
});
