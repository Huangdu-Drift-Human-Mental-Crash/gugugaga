import type { ContextPack, ExpertProfile, PageTextBlock } from "./types";

export function buildTranslationPrompt(input: {
  sourceLang: string;
  targetLang: string;
  blocks: PageTextBlock[];
  contextPack: ContextPack;
  expertProfile: ExpertProfile;
}): { system: string; user: string } {
  const { sourceLang, targetLang, blocks, contextPack, expertProfile } = input;
  const terms = Object.entries(contextPack.terms)
    .map(([source, target]) => `- ${source}: ${target}`)
    .join("\n");
  const contextSection = [
    `Page title: ${contextPack.title || "(unknown)"}`,
    `Site: ${contextPack.site || "(unknown)"}`,
    contextPack.headings.length ? `Headings:\n${contextPack.headings.map((heading) => `- ${heading}`).join("\n")}` : "",
    contextPack.summary ? `Summary:\n${contextPack.summary}` : "",
    terms ? `Terms:\n${terms}` : "",
    contextPack.styleGuide ? `Style guide:\n${contextPack.styleGuide}` : "",
    contextPack.rawTextSnippet ? `Context excerpt:\n${contextPack.rawTextSnippet.slice(0, expertProfile.contextBudget)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const system = [
    expertProfile.systemPrompt,
    expertProfile.stylePrompt,
    expertProfile.glossary ? `User glossary:\n${expertProfile.glossary}` : "",
    contextSection ? `Context awareness:\n${contextSection}` : "",
    "Return only valid JSON. Preserve every input id exactly. Do not add commentary.",
    blocks.some((block) => block.richText)
      ? "Some text contains placeholders like __BRX_INLINE_0__. Keep every placeholder exactly as-is in the translated text. Do not translate, delete, duplicate, or reorder placeholders."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload = blocks.map((block) => ({ id: block.id, text: block.richText?.source ?? block.text }));
  const user = [
    `Translate from ${sourceLang || "auto"} to ${targetLang}.`,
    "Return a JSON array of objects with shape {\"id\":\"...\",\"text\":\"...\"}.",
    JSON.stringify(payload),
  ].join("\n\n");
  return { system, user };
}

export function parseJsonTranslations(text: string): Array<{ id: string; text: string }> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const parsed: unknown = JSON.parse(candidate);
  if (!Array.isArray(parsed)) throw new Error("Provider response is not a JSON array.");
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Provider response contains a non-object item.");
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.text !== "string") {
      throw new Error("Provider response item must contain string id and text.");
    }
    return { id: record.id, text: record.text };
  });
}
