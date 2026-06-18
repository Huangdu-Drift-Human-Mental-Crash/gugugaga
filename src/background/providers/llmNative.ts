import { buildTranslationPrompt, parseJsonTranslations } from "../../shared/prompt";
import type { ContextPack, TranslateBatchRequest, TranslateBatchResult } from "../../shared/types";
import { brokerJson } from "../requestBroker";
import { ProviderError } from "./types";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface AnthropicResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

type NativeProvider = "gemini-native" | "anthropic-native";

function requireApiKey(request: TranslateBatchRequest, label: string): string {
  const key = request.providerConfig.apiKey.trim();
  if (!key) throw new ProviderError(`${label} requires an API key.`);
  return key;
}

function normalizeBaseUrl(baseUrl: string, fallback: string): string {
  return (baseUrl || fallback).replace(/\/+$/, "");
}

function resultFromJsonText(
  request: TranslateBatchRequest,
  started: number,
  content: string,
): TranslateBatchResult {
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

function buildContextSummaryPrompt(request: TranslateBatchRequest): { system: string; user: string } {
  return {
    system:
      "Extract translation context. Return only JSON with keys summary, terms, styleGuide. terms must be an object mapping source terms to target-language guidance.",
    user: JSON.stringify({
      targetLang: request.targetLang,
      title: request.contextPack.title,
      site: request.contextPack.site,
      headings: request.contextPack.headings,
      excerpt: request.contextPack.rawTextSnippet,
    }),
  };
}

function mergeContextSummary(request: TranslateBatchRequest, content: string): ContextPack {
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

function geminiModelPath(model: string): string {
  const normalized = (model || "gemini-3.5-flash").trim();
  return normalized.startsWith("models/") ? normalized : `models/${normalized}`;
}

function extractGeminiText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

async function callGemini(request: TranslateBatchRequest, prompt: { system: string; user: string }): Promise<string> {
  const key = requireApiKey(request, "Gemini Native");
  const baseUrl = normalizeBaseUrl(request.providerConfig.baseUrl, "https://generativelanguage.googleapis.com/v1beta");
  const modelPath = geminiModelPath(request.providerConfig.model);
  const data = await brokerJson<GeminiResponse>({
    profileId: "gemini-native",
    url: `${baseUrl}/${modelPath}:generateContent`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: prompt.system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt.user }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });
  const content = extractGeminiText(data);
  if (!content) throw new ProviderError("Gemini Native returned no text content.");
  return content;
}

function extractAnthropicText(data: AnthropicResponse): string {
  return data.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("").trim() ?? "";
}

async function callAnthropic(request: TranslateBatchRequest, prompt: { system: string; user: string }): Promise<string> {
  const key = requireApiKey(request, "Anthropic Native");
  const baseUrl = normalizeBaseUrl(request.providerConfig.baseUrl, "https://api.anthropic.com/v1");
  const model = request.providerConfig.model || "claude-sonnet-4-5";
  const data = await brokerJson<AnthropicResponse>({
    profileId: "anthropic-native",
    url: `${baseUrl}/messages`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.2,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    }),
  });
  const content = extractAnthropicText(data);
  if (!content) throw new ProviderError("Anthropic Native returned no text content.");
  return content;
}

async function callNativeProvider(
  provider: NativeProvider,
  request: TranslateBatchRequest,
  prompt: { system: string; user: string },
): Promise<string> {
  return provider === "gemini-native" ? callGemini(request, prompt) : callAnthropic(request, prompt);
}

export async function translateGeminiNative(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  const started = Date.now();
  const prompt = buildTranslationPrompt({
    sourceLang: request.sourceLang,
    targetLang: request.targetLang,
    blocks: request.blocks,
    contextPack: request.contextPack,
    expertProfile: request.expertProfile,
  });
  const content = await callNativeProvider("gemini-native", request, prompt);
  return resultFromJsonText(request, started, content);
}

export async function translateAnthropicNative(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  const started = Date.now();
  const prompt = buildTranslationPrompt({
    sourceLang: request.sourceLang,
    targetLang: request.targetLang,
    blocks: request.blocks,
    contextPack: request.contextPack,
    expertProfile: request.expertProfile,
  });
  const content = await callNativeProvider("anthropic-native", request, prompt);
  return resultFromJsonText(request, started, content);
}

export async function summarizeContextGeminiNative(request: TranslateBatchRequest): Promise<ContextPack> {
  const content = await callNativeProvider("gemini-native", request, buildContextSummaryPrompt(request));
  return mergeContextSummary(request, content);
}

export async function summarizeContextAnthropicNative(request: TranslateBatchRequest): Promise<ContextPack> {
  const content = await callNativeProvider("anthropic-native", request, buildContextSummaryPrompt(request));
  return mergeContextSummary(request, content);
}
