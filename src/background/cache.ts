import type { CacheStats, TranslationItemResult } from "../shared/types";

const CACHE_PREFIX = "br-cache-v1:";

export async function getCachedTranslation(key: string): Promise<string | undefined> {
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return typeof value === "string" ? value : undefined;
}

export async function setCachedTranslation(key: string, text: string): Promise<void> {
  await chrome.storage.local.set({ [key]: text });
}

export async function getCacheStats(): Promise<CacheStats> {
  const all = await chrome.storage.local.get(null);
  let entries = 0;
  let approxBytes = 0;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(CACHE_PREFIX)) continue;
    entries += 1;
    approxBytes += key.length + JSON.stringify(value).length;
  }
  return { entries, approxBytes };
}

export async function clearTranslationCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith(CACHE_PREFIX));
  if (keys.length) await chrome.storage.local.remove(keys);
}

export async function clearTranslationCacheForTextHashes(textHashes: string[]): Promise<number> {
  const uniqueHashes = new Set(textHashes.filter(Boolean));
  if (!uniqueHashes.size) return 0;
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => {
    if (!key.startsWith(CACHE_PREFIX)) return false;
    const [, textHash] = key.split(":");
    return Boolean(textHash && uniqueHashes.has(textHash));
  });
  if (keys.length) await chrome.storage.local.remove(keys);
  return keys.length;
}

export function cachedResult(id: string, text: string): TranslationItemResult {
  return { id, text, error: "", cached: true };
}
