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
            source: "Go to __BRX_INLINE_0__Codex__BRX_INLINE_0_END__.",
            placeholders: [
              {
                token: "__BRX_INLINE_0__",
                closeToken: "__BRX_INLINE_0_END__",
                tagName: "a",
                text: "Codex",
                attributes: { href: "#" },
              },
            ],
          },
        },
      ],
    });

    expect(prompt.system).toContain("You may translate text between matching open/end tokens");
    expect(prompt.user).toContain("Go to __BRX_INLINE_0__Codex__BRX_INLINE_0_END__.");
  });

  it("injects consistency plan and local context only when supplied", () => {
    const prompt = buildTranslationPrompt({
      sourceLang: "en",
      targetLang: "zh-CN",
      expertProfile: expert,
      contextPack,
      blocks: [{ id: "b2", hash: "h2", text: "The live version is expensive.", kind: "paragraph", visibility: "visible" }],
      consistencyPlan: {
        summary: "A page about MTG Auto Deck.",
        styleGuide: "Use technical Chinese.",
        termMap: { "MTG Auto Deck": "MTG Auto Deck" },
        phraseMap: { "live version": "在线版本" },
        doNotTranslate: ["GitHub"],
        planHash: "plan123",
      },
      localContext: {
        before: [{ id: "b1", hash: "h1", text: "I made a live version.", kind: "paragraph", visibility: "visible" }],
        after: [{ id: "b3", hash: "h3", text: "The project is on GitHub.", kind: "paragraph", visibility: "visible" }],
      },
    });

    expect(prompt.system).toContain("Document consistency plan");
    expect(prompt.system).toContain("live version: 在线版本");
    expect(prompt.system).toContain("GitHub");
    expect(prompt.user).toContain("Local context for reference only");
    expect(prompt.user).toContain("I made a live version.");
  });

  it("parses fenced JSON translations", () => {
    expect(parseJsonTranslations("```json\n[{\"id\":\"a\",\"text\":\"你好\"}]\n```")).toEqual([{ id: "a", text: "你好" }]);
  });
});
