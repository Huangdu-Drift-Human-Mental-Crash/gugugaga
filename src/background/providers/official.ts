import type { TranslateBatchRequest, TranslateBatchResult } from "../../shared/types";
import { brokerJson } from "../requestBroker";
import { ProviderError } from "./types";

function requireKey(request: TranslateBatchRequest, provider: string): string {
  const key = request.providerConfig.apiKey.trim();
  if (!key) throw new ProviderError(`${provider} requires an API key.`);
  return key;
}

function langForDeepL(lang: string): string {
  const normalized = lang.toUpperCase();
  if (normalized === "ZH-CN" || normalized === "ZH-TW") return "ZH";
  if (normalized === "EN-US" || normalized === "EN-GB") return normalized;
  return normalized.split("-")[0] ?? normalized;
}

export async function translateDeepLApi(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  const started = Date.now();
  const key = requireKey(request, "DeepL API");
  const params = new URLSearchParams();
  for (const block of request.blocks) params.append("text", block.text);
  params.set("target_lang", langForDeepL(request.targetLang));
  if (request.sourceLang !== "auto") params.set("source_lang", langForDeepL(request.sourceLang));
  const baseUrl = request.providerConfig.baseUrl || "https://api-free.deepl.com/v2";
  const data = await brokerJson<{ translations?: Array<{ text?: string }> }>({
    profileId: "deepl-api",
    url: `${baseUrl.replace(/\/+$/, "")}/translate`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  return {
    providerId: request.providerId,
    elapsedMs: Date.now() - started,
    rawResponseSummary: JSON.stringify(data).slice(0, 240),
    items: request.blocks.map((block, index) => {
      const text = data.translations?.[index]?.text ?? "";
      return { id: block.id, text, error: text ? "" : "DeepL omitted this block.", cached: false };
    }),
  };
}

export async function translateMicrosoftApi(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  const started = Date.now();
  const key = requireKey(request, "Microsoft Translator");
  const baseUrl = request.providerConfig.baseUrl || "https://api.cognitive.microsofttranslator.com";
  const query = new URLSearchParams({
    "api-version": "3.0",
    to: request.targetLang,
  });
  if (request.sourceLang !== "auto") query.set("from", request.sourceLang);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": key,
  };
  if (request.providerConfig.region) headers["Ocp-Apim-Subscription-Region"] = request.providerConfig.region;
  const data = await brokerJson<Array<{ translations?: Array<{ text?: string }> }>>({
    profileId: "microsoft-translator",
    url: `${baseUrl.replace(/\/+$/, "")}/translate?${query.toString()}`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers,
    body: JSON.stringify(request.blocks.map((block) => ({ Text: block.text }))),
  });
  return {
    providerId: request.providerId,
    elapsedMs: Date.now() - started,
    rawResponseSummary: JSON.stringify(data).slice(0, 240),
    items: request.blocks.map((block, index) => {
      const text = data[index]?.translations?.[0]?.text ?? "";
      return { id: block.id, text, error: text ? "" : "Microsoft omitted this block.", cached: false };
    }),
  };
}

export async function translateGoogleCloudApi(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  const started = Date.now();
  const key = requireKey(request, "Google Cloud Translate");
  const baseUrl = request.providerConfig.baseUrl || "https://translation.googleapis.com/language/translate/v2";
  const data = await brokerJson<{ data?: { translations?: Array<{ translatedText?: string }> } }>({
    profileId: "google-cloud-translate",
    url: `${baseUrl}?key=${encodeURIComponent(key)}`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: request.blocks.map((block) => block.text),
      target: request.targetLang,
      source: request.sourceLang === "auto" ? undefined : request.sourceLang,
      format: "text",
    }),
  });
  const translations = data.data?.translations ?? [];
  return {
    providerId: request.providerId,
    elapsedMs: Date.now() - started,
    rawResponseSummary: JSON.stringify(data).slice(0, 240),
    items: request.blocks.map((block, index) => {
      const text = translations[index]?.translatedText ?? "";
      return { id: block.id, text, error: text ? "" : "Google Cloud omitted this block.", cached: false };
    }),
  };
}
