import type { ConsistencyPlan, ContextPack, ExpertProfile, LocalContextWindow, PageTextBlock } from "./types";

export function buildTranslationPrompt(input: {
  sourceLang: string;
  targetLang: string;
  blocks: PageTextBlock[];
  contextPack: ContextPack;
  expertProfile: ExpertProfile;
  consistencyPlan?: ConsistencyPlan | undefined;
  localContext?: LocalContextWindow | undefined;
}): { system: string; user: string } {
  const { sourceLang, targetLang, blocks, contextPack, expertProfile, consistencyPlan, localContext } = input;
  const terms = Object.entries(contextPack.terms)
    .map(([source, target]) => `- ${source}: ${target}`)
    .join("\n");
  const planTermMap = consistencyPlan
    ? Object.entries(consistencyPlan.termMap)
        .map(([source, target]) => `- ${source}: ${target}`)
        .join("\n")
    : "";
  const planPhraseMap = consistencyPlan
    ? Object.entries(consistencyPlan.phraseMap)
        .map(([source, target]) => `- ${source}: ${target}`)
        .join("\n")
    : "";
  const planSection = consistencyPlan
    ? [
        consistencyPlan.summary ? `Document summary:\n${consistencyPlan.summary}` : "",
        consistencyPlan.styleGuide ? `Style guide:\n${consistencyPlan.styleGuide}` : "",
        planTermMap ? `Mandatory term map:\n${planTermMap}` : "",
        planPhraseMap ? `Mandatory phrase map:\n${planPhraseMap}` : "",
        consistencyPlan.doNotTranslate.length
          ? `Do not translate these exact strings:\n${consistencyPlan.doNotTranslate.map((item) => `- ${item}`).join("\n")}`
          : "",
        "You must follow the term map, phrase map, and do-not-translate list consistently. If a mapped phrase appears, use the mapped translation exactly.",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";
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
    planSection ? `Document consistency plan:\n${planSection}` : "",
    "Return only valid JSON. Preserve every input id exactly. Do not add commentary.",
    blocks.some((block) => block.richText)
      ? "Some text contains placeholders like __BRX_INLINE_0__ and __BRX_INLINE_0_END__. Keep every placeholder token exactly as-is. You may translate text between matching open/end tokens, but do not delete, duplicate, or reorder the tokens."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload = blocks.map((block) => ({ id: block.id, text: block.richText?.source ?? block.text }));
  const localContextPayload = localContext
    ? {
        before: localContext.before.map((block) => ({ id: block.id, text: block.text })),
        after: localContext.after.map((block) => ({ id: block.id, text: block.text })),
      }
    : undefined;
  const user = [
    `Translate from ${sourceLang || "auto"} to ${targetLang}.`,
    "Return a JSON array of objects with shape {\"id\":\"...\",\"text\":\"...\"}.",
    localContextPayload
      ? `Local context for reference only. Do not translate or output these context blocks:\n${JSON.stringify(localContextPayload)}`
      : "",
    JSON.stringify(payload),
  ]
    .filter(Boolean)
    .join("\n\n");
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
