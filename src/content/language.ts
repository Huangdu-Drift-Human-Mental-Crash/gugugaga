export type DetectedLanguage = "zh" | "ja" | "ko" | "unknown";

const LANGUAGE_PREFIX: Record<string, DetectedLanguage> = {
  zh: "zh",
  ja: "ja",
  ko: "ko",
};

function countMatches(text: string, regex: RegExp): number {
  return text.match(regex)?.length ?? 0;
}

export function normalizeLanguageFamily(language: string): DetectedLanguage {
  const normalized = language.toLowerCase();
  const prefix = normalized.split("-")[0] ?? normalized;
  return LANGUAGE_PREFIX[prefix] ?? "unknown";
}

export function detectCjkLanguage(text: string): DetectedLanguage {
  const han = countMatches(text, /\p{Script=Han}/gu);
  const kana = countMatches(text, /[\u3040-\u30ff]/g);
  const hangul = countMatches(text, /\p{Script=Hangul}/gu);
  if (hangul > 0) return "ko";
  if (kana > 0) return "ja";
  if (han > 0) return "zh";
  return "unknown";
}

export function isProbablyAlreadyTargetLanguage(text: string, targetLang: string): boolean {
  const target = normalizeLanguageFamily(targetLang);
  if (target === "unknown") return false;
  const detected = detectCjkLanguage(text);
  return detected !== "unknown" && detected === target;
}
