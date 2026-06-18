export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function blockHash(text: string): string {
  return stableHash(normalizeText(text).toLowerCase());
}

export function cacheKey(parts: {
  textHash: string;
  targetLang: string;
  providerId: string;
  providerScope?: string;
  model: string;
  expertId: string;
  contextVersion: string;
}): string {
  return [
    "br-cache-v1",
    parts.textHash,
    parts.targetLang,
    parts.providerId,
    parts.providerScope || "scope0",
    parts.model || "default",
    parts.expertId || "none",
    parts.contextVersion || "ctx0",
  ].join(":");
}
