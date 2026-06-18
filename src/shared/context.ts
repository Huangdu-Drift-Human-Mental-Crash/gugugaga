import type { ContextPack, PageTextBlock } from "./types";
import { maskSensitiveText } from "./sanitize";

export function buildContextPack(input: {
  title: string;
  site: string;
  headings: string[];
  blocks: PageTextBlock[];
  maxChars: number;
  maskSensitive: boolean;
}): ContextPack {
  const rawText = input.blocks
    .filter((block) => block.visibility === "visible")
    .map((block) => block.text)
    .join("\n")
    .slice(0, input.maxChars);
  const masked = input.maskSensitive ? maskSensitiveText(rawText) : { text: rawText, masked: false };
  return {
    title: input.title,
    site: input.site,
    headings: input.headings.slice(0, 24),
    summary: "",
    terms: {},
    styleGuide: "",
    rawTextSnippet: masked.text,
    masked: masked.masked,
  };
}

export function contextVersion(pack: ContextPack): string {
  const terms = Object.entries(pack.terms)
    .map(([source, target]) => `${source}=${target}`)
    .join("|");
  return [pack.title, pack.site, pack.summary, pack.styleGuide, terms].join("\n").slice(0, 1200);
}

