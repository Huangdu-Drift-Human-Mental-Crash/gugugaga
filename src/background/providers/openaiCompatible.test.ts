import { translateOpenAICompatible } from "./openaiCompatible";
import type { TranslateBatchRequest } from "../../shared/types";

const baseRequest: TranslateBatchRequest = {
  sourceLang: "en",
  targetLang: "zh-CN",
  providerId: "openai-compatible",
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
    id: "openai-compatible",
    enabled: true,
    apiKey: "test",
    baseUrl: "https://api.openai.test/v1",
    model: "gpt-test",
    region: "",
    experimentalEnabled: false,
    timeoutMs: 1000,
  },
};

describe("translateOpenAICompatible", () => {
  it("maps JSON response items back to block ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "[{\"id\":\"b1\",\"text\":\"你好\"}]" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await translateOpenAICompatible(baseRequest);
    expect(result.items[0]).toMatchObject({ id: "b1", text: "你好", error: "" });
  });
});
