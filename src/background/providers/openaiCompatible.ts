import { buildConsistencyPlanPrompt, parseConsistencyPlan } from "../../shared/consistency";
import { buildTranslationPrompt, parseJsonTranslations } from "../../shared/prompt";
import type {
  ConsistencyPlan,
  ConsistencyPlanRequest,
  ContextPack,
  TranslateBatchRequest,
  TranslateBatchResult,
} from "../../shared/types";
import { brokerJson } from "../requestBroker";
import { ProviderError } from "./types";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function normalizeBaseUrl(baseUrl: string): string {
  const fallback = "https://api.openai.com/v1";
  return (baseUrl || fallback).replace(/\/+$/, "");
}

function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function authHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  if (!apiKey && !isLocalBaseUrl(baseUrl)) {
    throw new ProviderError("OpenAI-compatible provider requires an API key unless the base URL is localhost.");
  }
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export async function translateOpenAICompatible(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  const started = Date.now();
  const baseUrl = normalizeBaseUrl(request.providerConfig.baseUrl);
  const model = request.providerConfig.model || "gpt-4o-mini";
  const prompt = buildTranslationPrompt({
    sourceLang: request.sourceLang,
    targetLang: request.targetLang,
    blocks: request.blocks,
    contextPack: request.contextPack,
    expertProfile: request.expertProfile,
    consistencyPlan: request.consistencyPlan,
    localContext: request.localContext,
  });
  const data = await brokerJson<ChatCompletionResponse>({
    profileId: "openai-compatible",
    url: `${baseUrl}/chat/completions`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(request.providerConfig.apiKey, baseUrl),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("OpenAI-compatible provider returned no message content.");
  const translations = parseJsonTranslations(content);
  const byId = new Map(translations.map((item) => [item.id, item.text]));
  return {
    providerId: request.providerId,
    elapsedMs: Date.now() - started,
    rawResponseSummary: content.slice(0, 240),
    items: request.blocks.map((block) => ({
      id: block.id,
      text: byId.get(block.id) ?? "",
      error: byId.has(block.id) ? "" : "Provider omitted this block id.",
      cached: false,
    })),
  };
}

export async function buildConsistencyPlanOpenAICompatible(
  request: ConsistencyPlanRequest,
): Promise<ConsistencyPlan> {
  const baseUrl = normalizeBaseUrl(request.providerConfig.baseUrl);
  const model = request.providerConfig.model || "gpt-4o-mini";
  const prompt = buildConsistencyPlanPrompt(request);
  const data = await brokerJson<ChatCompletionResponse>({
    profileId: "openai-compatible-consistency-plan",
    url: `${baseUrl}/chat/completions`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(request.providerConfig.apiKey, baseUrl),
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("OpenAI-compatible provider returned no consistency plan.");
  return parseConsistencyPlan(content);
}

export async function summarizeContextOpenAICompatible(request: TranslateBatchRequest): Promise<ContextPack> {
  const baseUrl = normalizeBaseUrl(request.providerConfig.baseUrl);
  const model = request.providerConfig.model || "gpt-4o-mini";
  const data = await brokerJson<ChatCompletionResponse>({
    profileId: "openai-compatible-context",
    url: `${baseUrl}/chat/completions`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(request.providerConfig.apiKey, baseUrl),
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Extract translation context. Return only JSON with keys summary, terms, styleGuide. terms must be an object mapping source terms to target-language guidance.",
        },
        {
          role: "user",
          content: JSON.stringify({
            targetLang: request.targetLang,
            title: request.contextPack.title,
            site: request.contextPack.site,
            headings: request.contextPack.headings,
            excerpt: request.contextPack.rawTextSnippet,
          }),
        },
      ],
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) return request.contextPack;
  try {
    const parsed = JSON.parse(content.trim()) as {
      summary?: unknown;
      terms?: unknown;
      styleGuide?: unknown;
    };
    return {
      ...request.contextPack,
      summary: typeof parsed.summary === "string" ? parsed.summary : request.contextPack.summary,
      terms:
        parsed.terms && typeof parsed.terms === "object" && !Array.isArray(parsed.terms)
          ? Object.fromEntries(
              Object.entries(parsed.terms as Record<string, unknown>)
                .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
            )
          : request.contextPack.terms,
      styleGuide: typeof parsed.styleGuide === "string" ? parsed.styleGuide : request.contextPack.styleGuide,
    };
  } catch {
    return {
      ...request.contextPack,
      summary: content.slice(0, 1000),
    };
  }
}
