export type DetectedLanguage = "zh" | "ja" | "ko" | "en" | "unknown";

const LANGUAGE_PREFIX: Record<string, DetectedLanguage> = {
  en: "en",
  zh: "zh",
  ja: "ja",
  ko: "ko",
};

function countMatches(text: string, regex: RegExp): number {
  return text.match(regex)?.length ?? 0;
}

function scriptCounts(text: string): Record<"han" | "kana" | "hangul" | "latin", number> {
  return {
    han: countMatches(text, /\p{Script=Han}/gu),
    kana: countMatches(text, /[\u3040-\u30ff]/g),
    hangul: countMatches(text, /\p{Script=Hangul}/gu),
    latin: countMatches(text, /\p{Script=Latin}/gu),
  };
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

export function detectTextLanguage(text: string): DetectedLanguage {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "unknown";
  const { han, kana, hangul, latin } = scriptCounts(normalized);
  if (hangul > 0 && hangul >= Math.max(han, kana, latin * 0.35)) return "ko";
  if (kana > 0 && kana >= Math.max(han * 0.25, latin * 0.2)) return "ja";
  if (han >= 4 && han >= latin * 0.45) return "zh";
  if (latin >= 12 && latin >= Math.max(han * 1.5, kana * 2, hangul * 2)) return "en";
  return detectCjkLanguage(normalized);
}

export function detectDominantLanguage(texts: string[]): DetectedLanguage {
  const counts = texts.reduce(
    (sum, text) => {
      const current = scriptCounts(text);
      sum.han += current.han;
      sum.kana += current.kana;
      sum.hangul += current.hangul;
      sum.latin += current.latin;
      return sum;
    },
    { han: 0, kana: 0, hangul: 0, latin: 0 },
  );
  const total = counts.han + counts.kana + counts.hangul + counts.latin;
  if (total < 12) return "unknown";
  const scores: Array<[DetectedLanguage, number]> = [
    ["zh", counts.han],
    ["ja", counts.kana],
    ["ko", counts.hangul],
    ["en", counts.latin],
  ];
  scores.sort((left, right) => right[1] - left[1]);
  const [language, score] = scores[0] ?? (["unknown", 0] as [DetectedLanguage, number]);
  if (score / total < 0.62) return "unknown";
  return language;
}

export function isProbablyAlreadyTargetLanguage(text: string, targetLang: string): boolean {
  const target = normalizeLanguageFamily(targetLang);
  if (target === "unknown") return false;
  const detected = detectTextLanguage(text);
  return detected !== "unknown" && detected === target;
}

export function isDominantTargetLanguage(texts: string[], targetLang: string): boolean {
  const target = normalizeLanguageFamily(targetLang);
  if (target === "unknown") return false;
  return detectDominantLanguage(texts) === target;
}
