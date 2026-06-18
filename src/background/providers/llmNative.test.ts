import type { TranslateBatchRequest } from "../../shared/types";
import { translateAnthropicNative, translateGeminiNative } from "./llmNative";

const baseRequest: TranslateBatchRequest = {
  sourceLang: "en",
  targetLang: "zh-CN",
  providerId: "gemini-native",
  displayMode: "dual",
  blocks: [{ id: "b1", hash: "h", text: "Hello", kind: "paragraph", visibility: "visible" }],
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
    id: "gemini-native",
    enabled: true,
    apiKey: "test-key",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-test",
    region: "",
    experimentalEnabled: false,
    timeoutMs: 1000,
  },
};

function firstFetchCall(fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] {
  const call = fetchMock.mock.calls[0];
  expect(call).toBeDefined();
  return call as unknown as [string, RequestInit];
}

describe("native LLM providers", () => {
  it("translates with Gemini generateContent", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "[{\"id\":\"b1\",\"text\":\"你好\"}]" }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateGeminiNative(baseRequest);
    const [url, init] = firstFetchCall(fetchMock);

    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-key" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
    expect(result.items[0]).toMatchObject({ id: "b1", text: "你好", error: "" });
  });

  it("translates with Anthropic Messages API", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "[{\"id\":\"b1\",\"text\":\"你好\"}]" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request: TranslateBatchRequest = {
      ...baseRequest,
      providerId: "anthropic-native",
      providerConfig: {
        ...baseRequest.providerConfig,
        id: "anthropic-native",
        baseUrl: "https://api.anthropic.com/v1",
        model: "claude-test",
      },
    };
    const result = await translateAnthropicNative(request);
    const [url, init] = firstFetchCall(fetchMock);

    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({
      "x-api-key": "test-key",
      "anthropic-version": "2023-06-01",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "claude-test",
      system: expect.stringContaining("Translate."),
      messages: [{ role: "user", content: expect.stringContaining("Hello") }],
    });
    expect(result.items[0]).toMatchObject({ id: "b1", text: "你好", error: "" });
  });
});
