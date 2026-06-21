import { buildConsistencyPlanPrompt, consistencyPlanHash, parseConsistencyPlan } from "./consistency";
import type { ConsistencyPlanRequest } from "./types";

const baseRequest: ConsistencyPlanRequest = {
  sourceLang: "en",
  targetLang: "zh-CN",
  providerId: "openai-compatible",
  blocks: [
    { id: "b1", hash: "h1", text: "I only made a live version.", kind: "paragraph", visibility: "visible" },
    { id: "b2", hash: "h2", text: "I do not recommend the live version.", kind: "paragraph", visibility: "visible" },
  ],
  contextPack: {
    title: "MTG Bench",
    site: "mtgautodeck.com",
    headings: ["MTG Bench"],
    summary: "",
    terms: {},
    styleGuide: "",
    rawTextSnippet: "I only made a live version.\nI do not recommend the live version.",
    masked: false,
  },
  expertProfile: {
    id: "general",
    name: "General",
    systemPrompt: "Translate faithfully.",
    stylePrompt: "Use natural Chinese.",
    glossary: "",
    contextBudget: 6000,
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

describe("consistency plan helpers", () => {
  it("builds a JSON-only planning prompt with page blocks", () => {
    const prompt = buildConsistencyPlanPrompt(baseRequest);

    expect(prompt.system).toContain("document-level translation consistency plan");
    expect(prompt.system).toContain("Return only valid JSON");
    expect(prompt.user).toContain("live version");
    expect(prompt.user).toContain("\"targetLang\":\"zh-CN\"");
  });

  it("parses fenced consistency JSON and computes a stable hash", () => {
    const plan = parseConsistencyPlan(
      "```json\n{\"summary\":\"A test page\",\"styleGuide\":\"Concise\",\"termMap\":{\"MTG\":\"MTG\"},\"phraseMap\":{\"live version\":\"在线版本\"},\"doNotTranslate\":[\"GitHub\"]}\n```",
    );

    expect(plan).toMatchObject({
      summary: "A test page",
      styleGuide: "Concise",
      termMap: { MTG: "MTG" },
      phraseMap: { "live version": "在线版本" },
      doNotTranslate: ["GitHub"],
    });
    expect(plan.planHash).toBe(
      consistencyPlanHash({
        summary: plan.summary,
        styleGuide: plan.styleGuide,
        termMap: plan.termMap,
        phraseMap: plan.phraseMap,
        doNotTranslate: plan.doNotTranslate,
      }),
    );
  });
});
