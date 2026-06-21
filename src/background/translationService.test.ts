import { contextVersion } from "../shared/context";
import { stableHash } from "../shared/hash";
import type { TranslateBatchRequest } from "../shared/types";
import { translationCacheKey } from "./translationService";

const baseRequest: TranslateBatchRequest = {
  sourceLang: "en",
  targetLang: "zh-CN",
  providerId: "openai-compatible",
  displayMode: "dual",
  blocks: [{ id: "b1", hash: "text-hash", text: "Hello", kind: "paragraph", visibility: "visible" }],
  contextPreflight: false,
  contextPack: {
    title: "Page title",
    site: "example.com",
    headings: [],
    summary: "",
    terms: {},
    styleGuide: "",
    rawTextSnippet: "Hello",
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

describe("translation cache identity", () => {
  it("keeps the legacy context version when no consistency plan is present", () => {
    const key = translationCacheKey(baseRequest, "text-hash");

    expect(key.endsWith(stableHash(contextVersion(baseRequest.contextPack)))).toBe(true);
  });

  it("uses the consistency plan hash when Smart Context plan mode succeeds", () => {
    const key = translationCacheKey(
      {
        ...baseRequest,
        consistencyPlan: {
          summary: "A page.",
          styleGuide: "Consistent.",
          termMap: {},
          phraseMap: { "live version": "在线版本" },
          doNotTranslate: [],
          planHash: "plan-hash",
        },
      },
      "text-hash",
    );

    expect(key.endsWith("plan-hash")).toBe(true);
  });
});
