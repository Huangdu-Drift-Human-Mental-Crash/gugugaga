import { stableHash } from "./hash";
import type { ConsistencyPlan, ConsistencyPlanRequest, PageTextBlock } from "./types";

const PLAN_BLOCK_CHAR_BUDGET = 12000;
const MAX_PLAN_BLOCKS = 160;

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate);
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
      .map(([key, val]) => [key.trim(), val.trim()])
      .filter(([key, val]) => key && val),
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export function consistencyPlanHash(plan: Omit<ConsistencyPlan, "planHash">): string {
  const normalized = {
    summary: plan.summary.trim(),
    styleGuide: plan.styleGuide.trim(),
    termMap: Object.fromEntries(Object.entries(plan.termMap).sort(([left], [right]) => left.localeCompare(right))),
    phraseMap: Object.fromEntries(Object.entries(plan.phraseMap).sort(([left], [right]) => left.localeCompare(right))),
    doNotTranslate: [...plan.doNotTranslate].sort((left, right) => left.localeCompare(right)),
  };
  return stableHash(JSON.stringify(normalized));
}

export function normalizeConsistencyPlan(input: unknown): ConsistencyPlan {
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const base = {
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    styleGuide: typeof record.styleGuide === "string" ? record.styleGuide.trim() : "",
    termMap: stringMap(record.termMap),
    phraseMap: stringMap(record.phraseMap),
    doNotTranslate: stringArray(record.doNotTranslate),
  };
  return {
    ...base,
    planHash: consistencyPlanHash(base),
  };
}

export function parseConsistencyPlan(text: string): ConsistencyPlan {
  return normalizeConsistencyPlan(extractJsonObject(text));
}

function blocksForPlan(blocks: PageTextBlock[]): Array<{ id: string; kind: string; text: string }> {
  const selected: Array<{ id: string; kind: string; text: string }> = [];
  let usedChars = 0;
  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;
    if (selected.length >= MAX_PLAN_BLOCKS) break;
    const remaining = PLAN_BLOCK_CHAR_BUDGET - usedChars;
    if (remaining <= 0) break;
    const clipped = text.length > remaining ? text.slice(0, remaining) : text;
    selected.push({ id: block.id, kind: block.kind, text: clipped });
    usedChars += clipped.length;
  }
  return selected;
}

export function buildConsistencyPlanPrompt(request: ConsistencyPlanRequest): { system: string; user: string } {
  const system = [
    request.expertProfile.systemPrompt,
    request.expertProfile.stylePrompt,
    request.expertProfile.glossary ? `User glossary:\n${request.expertProfile.glossary}` : "",
    "Create a document-level translation consistency plan before translation.",
    "Return only valid JSON with keys summary, styleGuide, termMap, phraseMap, doNotTranslate.",
    "termMap maps recurring terms or proper nouns from source text to preferred target-language translations.",
    "phraseMap maps recurring phrases whose translation must stay identical across the page.",
    "doNotTranslate lists product names, code identifiers, URLs, and other strings that should remain unchanged.",
    "Do not translate the page yet. Do not include commentary.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = JSON.stringify({
    sourceLang: request.sourceLang || "auto",
    targetLang: request.targetLang,
    title: request.contextPack.title,
    site: request.contextPack.site,
    headings: request.contextPack.headings,
    summaryHint: request.contextPack.summary,
    excerpt: request.contextPack.rawTextSnippet,
    blocks: blocksForPlan(request.blocks),
  });

  return { system, user };
}
