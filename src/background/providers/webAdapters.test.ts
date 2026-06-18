import { translateBingWeb, translateGoogleWeb } from "./webAdapters";
import type { TranslateBatchRequest } from "../../shared/types";

function baseRequest(providerId: "bing-web" | "google-web"): TranslateBatchRequest {
  return {
    sourceLang: "en",
    targetLang: "zh-CN",
    providerId,
    displayMode: "dual",
    blocks: [{ id: "b1", hash: "h1", text: "Assistant Professor", kind: "paragraph", visibility: "visible" }],
    contextPreflight: false,
    contextPack: {
      title: "",
      site: "",
      headings: [],
      summary: "",
      terms: {},
      styleGuide: "",
      rawTextSnippet: "",
      masked: false,
    },
    expertProfile: {
      id: "general",
      name: "General",
      systemPrompt: "Translate.",
      stylePrompt: "",
      glossary: "",
      contextBudget: 1000,
    },
    providerConfig: {
      id: providerId,
      enabled: true,
      apiKey: "",
      baseUrl:
        providerId === "bing-web"
          ? "https://api-edge.cognitive.microsofttranslator.com"
          : "https://translate.googleapis.com",
      model: "",
      region: "",
      experimentalEnabled: true,
      timeoutMs: 1000,
    },
  };
}

function fakeJwt(): string {
  return `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }))}.sig`;
}

describe("web adapters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets an Edge token before calling Bing Web", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target === "https://edge.microsoft.com/translate/auth") {
        return new Response(fakeJwt(), { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      expect(target).toContain("https://api-edge.cognitive.microsofttranslator.com/translate?");
      expect(target).toContain("to=zh-Hans");
      expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
      return new Response(JSON.stringify([{ translations: [{ text: "助理教授" }] }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateBingWeb(baseRequest("bing-web"));

    expect(result.items[0]).toMatchObject({ id: "b1", text: "助理教授", error: "" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps Google Web block failures scoped to the failing item", async () => {
    const request = baseRequest("google-web");
    request.blocks = [
      request.blocks[0]!,
      { id: "b2", hash: "h2", text: "Broken text", kind: "paragraph", visibility: "visible" },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify([[["助理教授", "Assistant Professor"]]]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(new Response("<html>error</html>", { status: 500 })),
    );

    const result = await translateGoogleWeb(request);

    expect(result.items[0]).toMatchObject({ id: "b1", text: "助理教授", error: "" });
    expect(result.items[1]?.id).toBe("b2");
    expect(result.items[1]?.error).toContain("google-web request failed with 500");
  });
});
