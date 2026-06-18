import { cacheKey, stableHash } from "../shared/hash";
import { contextVersion } from "../shared/context";
import type { TranslateBatchRequest, TranslateBatchResult, TranslationItemResult } from "../shared/types";
import { getCachedTranslation, setCachedTranslation, cachedResult } from "./cache";
import { getProviderDescriptor, getProviderTranslator } from "./providers/registry";
import { failedProviderResult } from "./providers/types";
import { summarizeContextOpenAICompatible } from "./providers/openaiCompatible";
import { summarizeContextAnthropicNative, summarizeContextGeminiNative } from "./providers/llmNative";

function itemCacheKey(request: TranslateBatchRequest, textHash: string): string {
  return cacheKey({
    textHash,
    targetLang: request.targetLang,
    providerId: request.providerId,
    providerScope: stableHash(request.providerConfig.baseUrl || request.providerId),
    model: request.providerConfig.model,
    expertId: request.expertProfile.id,
    contextVersion: stableHash(contextVersion(request.contextPack)),
  });
}

async function maybeEnhanceContext(request: TranslateBatchRequest): Promise<TranslateBatchRequest> {
  const descriptor = getProviderDescriptor(request.providerId);
  if (!request.contextPreflight || !descriptor?.capabilities.contextPreflight || !request.contextPack.rawTextSnippet) {
    return request;
  }
  const enhanced =
    request.providerId === "openai-compatible"
      ? await summarizeContextOpenAICompatible(request)
      : request.providerId === "gemini-native"
        ? await summarizeContextGeminiNative(request)
        : request.providerId === "anthropic-native"
          ? await summarizeContextAnthropicNative(request)
          : request.contextPack;
  if (enhanced === request.contextPack) return request;
  return { ...request, contextPack: enhanced };
}

export async function translateBatchWithCache(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  const started = Date.now();
  const descriptor = getProviderDescriptor(request.providerId);
  if (!request.providerConfig.enabled) {
    return failedProviderResult(
      request,
      `${descriptor?.label ?? request.providerId} is disabled. Enable it in Options before translating.`,
    );
  }

  const enhancedRequest = await maybeEnhanceContext(request);
  const cachedItems: TranslationItemResult[] = [];
  const misses = [];

  for (const block of enhancedRequest.blocks) {
    const key = itemCacheKey(enhancedRequest, block.hash);
    const cached = await getCachedTranslation(key);
    if (cached) cachedItems.push(cachedResult(block.id, cached));
    else misses.push({ block, key });
  }

  if (!misses.length) {
    return {
      providerId: request.providerId,
      elapsedMs: Date.now() - started,
      rawResponseSummary: "cache-hit",
      items: cachedItems,
    };
  }

  const translator = getProviderTranslator(enhancedRequest.providerId);
  const missRequest: TranslateBatchRequest = {
    ...enhancedRequest,
    blocks: misses.map((miss) => miss.block),
  };

  let providerResult: TranslateBatchResult;
  try {
    providerResult = await translator(missRequest);
  } catch (error) {
    providerResult = failedProviderResult(missRequest, error);
  }

  const keyById = new Map(misses.map((miss) => [miss.block.id, miss.key]));
  for (const item of providerResult.items) {
    if (!item.error && item.text) {
      const key = keyById.get(item.id);
      if (key) await setCachedTranslation(key, item.text);
    }
  }

  const merged = [...cachedItems, ...providerResult.items];
  const order = new Map(enhancedRequest.blocks.map((block, index) => [block.id, index]));
  merged.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  return {
    ...providerResult,
    elapsedMs: Date.now() - started,
    items: merged,
  };
}
