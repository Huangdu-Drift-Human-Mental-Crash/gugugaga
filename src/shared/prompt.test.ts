import { buildTranslationPrompt, parseJsonTranslations } from "./prompt";

const expert = {
  id: "general",
  name: "General",
  systemPrompt: "Translate accurately.",
  stylePrompt: "Be concise.",
  glossary: "API = API",
  contextBudget: 200,
};

const contextPack = {
  title: "Docs",
  site: "example.com",
  headings: ["Intro"],
  summary: "A docs page.",
  terms: { hook: "钩子" },
  styleGuide: "Technical.",
  rawTextSnippet: "This page discusses hooks.",
  masked: false,
};

describe("prompt helpers", () => {
  it("builds JSON-only translation prompts", () => {
    const prompt = buildTranslationPrompt({
      sourceLang: "en",
      targetLang: "zh-CN",
      expertProfile: expert,
      contextPack,
      blocks: [{ id: "b1", hash: "h", text: "Hello", kind: "paragraph", visibility: "visible" }],
    });
    expect(prompt.system).toContain("Context awareness");
    expect(prompt.user).toContain("\"id\":\"b1\"");
  });

  it("uses rich text source and instructs placeholder preservation", () => {
    const prompt = buildTranslationPrompt({
      sourceLang: "en",
      targetLang: "zh-CN",
      expertProfile: expert,
      contextPack,
      blocks: [
        {
          id: "b1",
          hash: "h",
          text: "Go to Codex.",
          kind: "paragraph",
          visibility: "visible",
          richText: {
            source: "Go to __BRX_INLINE_0__.",
            placeholders: [{ token: "__BRX_INLINE_0__", tagName: "a", text: "Codex", attributes: { href: "#" } }],
          },
        },
      ],
    });

    expect(prompt.system).toContain("Keep every placeholder exactly as-is");
    expect(prompt.user).toContain("Go to __BRX_INLINE_0__.");
  });

  it("parses fenced JSON translations", () => {
    expect(parseJsonTranslations("```json\n[{\"id\":\"a\",\"text\":\"你好\"}]\n```")).toEqual([{ id: "a", text: "你好" }]);
  });
});
