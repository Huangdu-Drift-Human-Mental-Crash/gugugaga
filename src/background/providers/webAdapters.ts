import type { TranslateBatchRequest, TranslateBatchResult } from "../../shared/types";
import { brokerJson, brokerText } from "../requestBroker";
import { ProviderError } from "./types";

interface BingTokenState {
  token: string;
  expiresAt: number;
}

let bingTokenState: BingTokenState | undefined;

function assertExperimentalEnabled(request: TranslateBatchRequest, label: string): void {
  if (!request.providerConfig.experimentalEnabled) {
    throw new ProviderError(`${label} is experimental. Enable it in Options before use.`);
  }
}

function asGoogleTranslation(data: unknown): string {
  if (!Array.isArray(data)) return "";
  const sentences = data[0];
  if (!Array.isArray(sentences)) return "";
  return sentences
    .map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
    .join("");
}

function itemError(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { id, text: "", error: message, cached: false };
}

async function translateGoogleBlock(request: TranslateBatchRequest, text: string): Promise<string> {
  const query = new URLSearchParams({
    client: "gtx",
    sl: request.sourceLang === "auto" ? "auto" : request.sourceLang,
    tl: request.targetLang,
    dt: "t",
  });
  const data = await brokerJson<unknown>({
    profileId: "google-web",
    url: `https://translate.googleapis.com/translate_a/single?${query.toString()}`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: text }),
  });
  return asGoogleTranslation(data);
}

export async function translateGoogleWeb(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  assertExperimentalEnabled(request, "Google Web");
  const started = Date.now();
  const items = [];
  for (const block of request.blocks) {
    try {
      const text = await translateGoogleBlock(request, block.text);
      items.push({
        id: block.id,
        text,
        error: text ? "" : "Google Web returned an unrecognized response.",
        cached: false,
      });
    } catch (error) {
      items.push(itemError(block.id, error));
    }
  }
  return {
    providerId: request.providerId,
    elapsedMs: Date.now() - started,
    rawResponseSummary: "google-web",
    items,
  };
}

function decodeJwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function getBingEdgeToken(timeoutMs: number): Promise<string> {
  const now = Date.now();
  if (bingTokenState && bingTokenState.expiresAt - 60_000 > now) return bingTokenState.token;

  const token = (await brokerText({
    profileId: "bing-web-auth",
    url: "https://edge.microsoft.com/translate/auth",
    timeoutMs,
    headers: {
      Accept: "*/*",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: "https://appsumo.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Edg/120",
    },
  })).trim();
  if (!token) throw new ProviderError("Bing Web auth returned an empty token.");
  const expiresAt = decodeJwtExpiry(token) || now + 8 * 60_000;
  bingTokenState = { token, expiresAt };
  return token;
}

function langForBingWeb(lang: string): string {
  const normalized = lang.toLowerCase();
  if (normalized === "zh-cn" || normalized === "zh-hans") return "zh-Hans";
  if (normalized === "zh-tw" || normalized === "zh-hant") return "zh-Hant";
  return lang;
}

export async function translateBingWeb(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  assertExperimentalEnabled(request, "Bing Web");
  const started = Date.now();
  const token = await getBingEdgeToken(request.providerConfig.timeoutMs);
  const query = new URLSearchParams({
    "api-version": "3.0",
    to: langForBingWeb(request.targetLang),
    includeSentenceLength: "true",
  });
  if (request.sourceLang !== "auto") query.set("from", langForBingWeb(request.sourceLang));
  const data = await brokerJson<Array<{ translations?: Array<{ text?: string }> }>>({
    profileId: "bing-web",
    url: `https://api-edge.cognitive.microsofttranslator.com/translate?${query.toString()}`,
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Edg/120",
    },
    body: JSON.stringify(request.blocks.map((block) => ({ Text: block.text }))),
  });
  return {
    providerId: request.providerId,
    elapsedMs: Date.now() - started,
    rawResponseSummary: JSON.stringify(data).slice(0, 240),
    items: request.blocks.map((block, index) => {
      const text = data[index]?.translations?.[0]?.text ?? "";
      return { id: block.id, text, error: text ? "" : "Bing Web omitted this block.", cached: false };
    }),
  };
}

function langForDeepLWeb(lang: string): string {
  if (lang.toLowerCase().startsWith("zh")) return "ZH";
  return (lang.split("-")[0] ?? lang).toUpperCase();
}

export async function translateDeepLWebExperimental(request: TranslateBatchRequest): Promise<TranslateBatchResult> {
  assertExperimentalEnabled(request, "DeepL Web Experimental");
  const started = Date.now();
  const id = Math.floor(Math.random() * 10000000) + 1000000;
  const data = await brokerJson<{ result?: { texts?: Array<{ text?: string }> } }>({
    profileId: "deepl-web-experimental",
    url: "https://www2.deepl.com/jsonrpc?method=LMT_handle_texts",
    method: "POST",
    timeoutMs: request.providerConfig.timeoutMs,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "LMT_handle_texts",
      id,
      params: {
        splitting: "newlines",
        lang: {
          source_lang_user_selected: request.sourceLang === "auto" ? "auto" : langForDeepLWeb(request.sourceLang),
          target_lang: langForDeepLWeb(request.targetLang),
        },
        texts: request.blocks.map((block) => ({ text: block.text, requestAlternatives: 0 })),
        timestamp: Date.now(),
      },
    }),
  });
  const texts = data.result?.texts ?? [];
  return {
    providerId: request.providerId,
    elapsedMs: Date.now() - started,
    rawResponseSummary: JSON.stringify(data).slice(0, 240),
    items: request.blocks.map((block, index) => {
      const text = texts[index]?.text ?? "";
      return { id: block.id, text, error: text ? "" : "DeepL Web omitted this block.", cached: false };
    }),
  };
}
